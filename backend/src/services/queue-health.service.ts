import {QueueHealthIssue, QueueHealthStatus, QueuePriority} from '../types/queue';
import {QueueService} from './queue.service';
import config from '../config';
import logger from '../utils/logger';
import {queueMetrics} from '../monitoring/metrics';
import {NotificationChannel} from "@/types/notification";

export class QueueHealthService {
    private queueService: QueueService;
    private circuitState: Map<NotificationChannel, boolean> = new Map();
    private errorCounts: Map<NotificationChannel, number> = new Map();
    private readonly errorThreshold = 5;
    private readonly recoveryTime = 60000; // 1 minute

    constructor() {
        this.queueService = new QueueService();
        this.initializeCircuits();
    }

    private initializeCircuits() {
        Object.values(NotificationChannel).forEach(channel => {
            this.circuitState.set(channel, true); // true = closed (healthy)
            this.errorCounts.set(channel, 0);
        });
    }

    async checkHealth(channel: NotificationChannel): Promise<QueueHealthStatus> {
        const issues: QueueHealthIssue[] = [];
        const stats = await this.queueService.getQueueStats(channel);

        try {
            // Initialize metrics object with all priorities set to 0
            const queueSizes: Record<QueuePriority, number> = {
                [QueuePriority.CRITICAL]: 0,
                [QueuePriority.HIGH]: 0,
                [QueuePriority.MEDIUM]: 0,
                [QueuePriority.LOW]: 0
            };

            // Check queue sizes and update metrics
            Object.entries(stats.priorityQueues).forEach(([priority, queueStats]) => {
                const priorityEnum = priority as QueuePriority;
                queueSizes[priorityEnum] = queueStats.size;

                const maxSize = config.queue.priorities[priorityEnum].maxSize;
                if (queueStats.size > maxSize) {
                    issues.push({
                        type: 'WARNING',
                        message: `Queue size exceeded threshold`,
                        priority: priorityEnum,
                        metric: 'size',
                        threshold: maxSize,
                        currentValue: queueStats.size
                    });
                }

                // Check processing rate
                if (queueStats.processingRate === 0 && queueStats.size > 0) {
                    issues.push({
                        type: 'ERROR',
                        message: `Queue processing stalled`,
                        priority: priorityEnum,
                        metric: 'processingRate'
                    });
                }

                // Check error rate
                const maxErrorRate = config.queue.priorities[priorityEnum].maxErrorRate;
                if (queueStats.errorRate && queueStats.errorRate > maxErrorRate) {
                    issues.push({
                        type: 'ERROR',
                        message: `High error rate detected`,
                        priority: priorityEnum,
                        metric: 'errorRate',
                        threshold: maxErrorRate,
                        currentValue: queueStats.errorRate
                    });
                }
            });

            // Check DLQ
            if (stats.dlq.size > config.queue.dlq.maxSize) {
                issues.push({
                    type: 'ERROR',
                    message: `DLQ size exceeded threshold`,
                    metric: 'dlqSize',
                    threshold: config.queue.dlq.maxSize,
                    currentValue: stats.dlq.size
                });
            }

            // Check stuck processing items
            if (stats.processingItems > config.queue.maxProcessingItems) {
                issues.push({
                    type: 'WARNING',
                    message: `Too many items in processing state`,
                    metric: 'processingItems',
                    threshold: config.queue.maxProcessingItems,
                    currentValue: stats.processingItems
                });
            }

            // Update health metrics
            this.updateHealthMetrics(channel, stats, issues);

            // Update circuit breaker state
            this.updateCircuitState(channel, issues);

            return {
                healthy: issues.filter(i => i.type === 'ERROR').length === 0,
                metrics: {
                    queueSizes,
                    dlqSize: stats.dlq.size,
                    processingItems: stats.processingItems,
                    errorRate: this.calculateOverallErrorRate(stats),
                    processingRate: this.calculateOverallProcessingRate(stats)
                },
                issues
            };

        } catch (error) {
            logger.error('Health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                channel
            });

            // Return a properly typed error response
            return {
                healthy: false,
                metrics: {
                    queueSizes: {
                        [QueuePriority.CRITICAL]: 0,
                        [QueuePriority.HIGH]: 0,
                        [QueuePriority.MEDIUM]: 0,
                        [QueuePriority.LOW]: 0
                    },
                    dlqSize: 0,
                    processingItems: 0,
                    errorRate: 0,
                    processingRate: 0
                },
                issues: [{
                    type: 'ERROR',
                    message: 'Health check failed',
                    metric: 'system'
                }]
            };
        }
    }

    isCircuitClosed(channel: NotificationChannel): boolean {
        return this.circuitState.get(channel) ?? false;
    }

    private updateCircuitState(channel: NotificationChannel, issues: QueueHealthIssue[]) {
        const errorCount = this.errorCounts.get(channel) ?? 0;
        const criticalErrors = issues.filter(i => i.type === 'ERROR').length;

        if (criticalErrors > 0) {
            this.errorCounts.set(channel, errorCount + 1);
            if (errorCount + 1 >= this.errorThreshold) {
                this.openCircuit(channel);
            }
        } else {
            this.errorCounts.set(channel, 0);
            if (!this.isCircuitClosed(channel)) {
                setTimeout(() => this.closeCircuit(channel), this.recoveryTime);
            }
        }
    }

    private openCircuit(channel: NotificationChannel) {
        if (this.isCircuitClosed(channel)) {
            this.circuitState.set(channel, false);
            logger.error('Circuit breaker opened', { channel });
            queueMetrics.circuitBreaker.set({ channel }, 0);
        }
    }

    private closeCircuit(channel: NotificationChannel) {
        if (!this.isCircuitClosed(channel)) {
            this.circuitState.set(channel, true);
            logger.info('Circuit breaker closed', { channel });
            queueMetrics.circuitBreaker.set({ channel }, 1);
        }
    }

    private updateHealthMetrics(
        channel: NotificationChannel,
        // @ts-ignore
        stats: any,
        issues: QueueHealthIssue[]
    ) {
        // Count warnings and errors separately
        const warnings = issues.filter(i => i.type === 'WARNING').length;
        const errors = issues.filter(i => i.type === 'ERROR').length;

        // Update health issues metrics
        queueMetrics.healthIssues.set(
            { channel, type: 'warning' },
            warnings
        );
        queueMetrics.healthIssues.set(
            { channel, type: 'error' },
            errors
        );

        // Update critical issues metric
        queueMetrics.criticalIssues.set(
            { channel },
            errors
        );

        // Update circuit breaker metric
        queueMetrics.circuitBreaker.set(
            { channel },
            this.isCircuitClosed(channel) ? 1 : 0
        );
    }

    private calculateOverallErrorRate(stats: any): number {
        let totalErrors = 0;
        let totalProcessed = 0;

        Object.values(stats.priorityQueues).forEach((queueStats: any) => {
            totalErrors += queueStats.errorRate || 0;
            totalProcessed += queueStats.processingRate || 0;
        });

        return totalProcessed > 0 ? (totalErrors / totalProcessed) * 100 : 0;
    }

    private calculateOverallProcessingRate(stats: any): number {
        return Object.values(stats.priorityQueues).reduce(
            (sum: number, queueStats: any) => sum + (queueStats.processingRate || 0),
            0
        );
    }
}