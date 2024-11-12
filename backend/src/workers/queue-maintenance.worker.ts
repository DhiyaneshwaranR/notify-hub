import { NotificationChannel } from '../types/notification';
import { QueueService } from '../services/queue.service';
import { QueueHealthService } from '../services/queue-health.service';
import config from '../config';
import logger from '../utils/logger';
import {queueMetrics} from "@/monitoring/metrics";

export class QueueMaintenanceWorker {
    private queueService: QueueService;
    private healthService: QueueHealthService;
    private isRunning: boolean = false;
    private maintenanceInterval: NodeJS.Timeout | null = null;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.queueService = new QueueService();
        this.healthService = new QueueHealthService();
    }

    async start(): Promise<void> {
        this.isRunning = true;

        // Schedule maintenance tasks
        this.maintenanceInterval = setInterval(
            () => this.runMaintenance(),
            config.queue.maintenance.interval
        );

        // Schedule health checks
        this.healthCheckInterval = setInterval(
            () => this.runHealthChecks(),
            config.queue.healthCheck.interval
        );

        logger.info('Queue maintenance worker started');
    }

    stop(): void {
        this.isRunning = false;

        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
        }

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        logger.info('Queue maintenance worker stopped');
    }

    private async runMaintenance(): Promise<void> {
        if (!this.isRunning) return;

        logger.info('Starting queue maintenance cycle');
        const startTime = Date.now();

        for (const channel of Object.values(NotificationChannel)) {
            try {
                // Increment maintenance run counter
                queueMetrics.maintenanceRuns.inc({
                    channel,
                    type: 'cleanup'
                });

                // Cleanup expired items
                const cleanupStart = Date.now();
                const cleanedCount = await this.queueService.cleanupExpiredItems(channel);
                queueMetrics.maintenanceDuration.observe(
                    { channel, operation: 'cleanup' },
                    (Date.now() - cleanupStart) / 1000
                );

                if (cleanedCount > 0) {
                    logger.info('Cleaned expired items', {
                        channel,
                        count: cleanedCount
                    });
                }

                // Requeue stuck items
                queueMetrics.maintenanceRuns.inc({
                    channel,
                    type: 'requeue'
                });

                const requeueStart = Date.now();
                const requeuedCount = await this.queueService.requeueStuckItems(channel);
                queueMetrics.maintenanceDuration.observe(
                    { channel, operation: 'requeue' },
                    (Date.now() - requeueStart) / 1000
                );

                if (requeuedCount > 0) {
                    logger.info('Requeued stuck items', {
                        channel,
                        count: requeuedCount
                    });
                }

                // Record total maintenance duration
                queueMetrics.maintenanceDuration.observe(
                    { channel, operation: 'total' },
                    (Date.now() - startTime) / 1000
                );

            } catch (error) {
                logger.error('Maintenance task failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    channel
                });
            }
        }
    }

    private async handleHealthIssues(channel: NotificationChannel, health: any): Promise<void> {
        for (const issue of health.issues) {
            try {
                switch (issue.metric) {
                    case 'processingRate':
                        // Try to recover stalled processing
                        await this.queueService.requeueStuckItems(channel);
                        queueMetrics.recoveryActions.inc({
                            channel,
                            action_type: 'requeue_stalled'
                        });
                        break;

                    case 'dlqSize':
                        // Trigger DLQ processing if size is too large
                        if (issue.currentValue > issue.threshold) {
                            queueMetrics.recoveryActions.inc({
                                channel,
                                action_type: 'process_dlq'
                            });
                            logger.info('Triggering DLQ processing', { channel });
                        }
                        break;

                    case 'errorRate':
                        if (issue.currentValue > issue.threshold) {
                            queueMetrics.recoveryActions.inc({
                                channel,
                                action_type: 'error_rate_mitigation'
                            });
                            logger.warn('High error rate detected', {
                                channel,
                                errorRate: issue.currentValue
                            });
                        }
                        break;

                    default:
                        logger.warn('Unhandled health issue', {
                            channel,
                            issue
                        });
                }
            } catch (error) {
                logger.error('Recovery action failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    channel,
                    issue
                });
            }
        }
    }

    private async runHealthChecks(): Promise<void> {
        if (!this.isRunning) return;

        logger.info('Starting health check cycle');

        for (const channel of Object.values(NotificationChannel)) {
            try {
                const health = await this.healthService.checkHealth(channel);

                if (!health.healthy) {
                    logger.warn('Queue health issues detected', {
                        channel,
                        issues: health.issues
                    });

                    // Take automated recovery actions based on issues
                    await this.handleHealthIssues(channel, health);
                }

            } catch (error) {
                logger.error('Health check failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    channel
                });
            }
        }
    }


}