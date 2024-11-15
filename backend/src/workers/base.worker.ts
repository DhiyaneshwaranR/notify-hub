import { NotificationChannel, NotificationPriority, NotificationRequest } from '../types/notification';
import { QueueService } from '../services/queue.service';
import { QueuedItem } from '../types/queue';
import { workerMetrics } from '../monitoring/metrics';
import logger from '../utils/logger';
import config from '../config';

export abstract class BaseWorker {
    protected isRunning: boolean = false;
    protected queueService: QueueService;
    protected workerInstances: Map<NotificationPriority, boolean> = new Map();
    protected readonly processingTimeout = 30000; // 30 seconds timeout
    private lastProcessedTimestamp: number = Date.now();

    constructor(protected readonly channel: NotificationChannel) {
        this.queueService = new QueueService();

        Object.values(NotificationPriority).forEach(priority => {
            this.workerInstances.set(priority, false);
        });
    }
    abstract processNotification(notification: NotificationRequest): Promise<boolean>;

    async processQueuedItem(queuedItem: QueuedItem<NotificationRequest>): Promise<boolean> {
        const notification: NotificationRequest = {
            ...queuedItem.data,
            metadata: {
                ...queuedItem.data.metadata,
                queuedItemId: queuedItem.id,
                retryAttempt: queuedItem.attemptCount,
                lastAttempt: queuedItem.lastAttemptAt
            }
        };

        const startTime = Date.now();

        try {
            const success = await this.processNotification(notification);
            const duration = Date.now() - startTime;

            // Record success metrics
            this.recordMetrics(notification.priority, success, duration);

            return success;
        } catch (error) {
            const duration = Date.now() - startTime;

            // Record failure metrics
            this.recordMetrics(notification.priority, false, duration);

            throw error;
        }
    }

    protected recordMetrics(priority: NotificationPriority, success: boolean, duration: number): void {
        workerMetrics.processingTime.observe(
            {
                channel: this.channel,
                priority,
                success: String(success)
            },
            duration
        );

        workerMetrics.processedNotifications.inc({
            channel: this.channel,
            priority,
            status: success ? 'success' : 'failure'
        });
    }

    async start(): Promise<void> {
        try {
            this.isRunning = true;
            this.lastProcessedTimestamp = Date.now();
            workerMetrics.workerStatus.set(
                { channel: this.channel, status: 'running' },
                1
            );

            await this.startWorkersByPriority();
            logger.info('Worker started', {
                channel: this.channel,
                priorities: Object.values(NotificationPriority)
            });
        } catch (error) {
            this.isRunning = false;
            workerMetrics.workerErrors.inc({
                channel: this.channel,
                error_type: 'startup'
            });
            workerMetrics.workerStatus.set(
                { channel: this.channel, status: 'failed' },
                1
            );
            throw error;
        }
    }

    protected async cleanupPendingOperations(): Promise<void> {
        try {
            const stats = await this.queueService.getQueueStats(this.channel);

            // Handle the case where stats might be undefined or have a different structure
            const pendingCount = stats?.processingItems ||
                (stats?.priorityQueues ? Object.values(stats.priorityQueues)
                    .reduce((total, queue) => total + (queue.size || 0), 0) : 0);

            if (pendingCount > 0) {
                logger.info('Cleaning up pending operations', {
                    channel: this.channel,
                    pendingCount
                });

                // Cleanup logic here
                await Promise.all(Object.values(NotificationPriority).map(async (priority) => {
                    this.workerInstances.set(priority, false);
                }));
            }
        } catch (error) {
            logger.error('Error cleaning up pending operations', {
                error: error instanceof Error ? error.message : 'Unknown error',
                channel: this.channel
            });
        }
    }

    async stop(): Promise<void> {
        try {
            this.isRunning = false;

            // Set worker status
            workerMetrics.workerStatus.set(
                { channel: this.channel, status: 'stopped' },
                1
            );
            workerMetrics.activeWorkers.set(
                { channel: this.channel },
                0
            );

            // Perform cleanup and wait for it to complete
            try {
                await this.cleanup();
            } catch (error) {
                workerMetrics.workerErrors.inc({
                    channel: this.channel,
                    error_type: 'cleanup'
                });
                logger.error('Error during cleanup', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    channel: this.channel
                });
            }

            logger.info('Worker stopped', { channel: this.channel });
        } catch (error) {
            workerMetrics.workerErrors.inc({
                channel: this.channel,
                error_type: 'cleanup'
            });
            logger.error('Error stopping worker', {
                error: error instanceof Error ? error.message : 'Unknown error',
                channel: this.channel
            });
            throw error;
        }
    }

    protected async cleanup(): Promise<void> {
        // Stop all priority workers first
        Object.values(NotificationPriority).forEach(priority => {
            this.workerInstances.set(priority, false);
        });

        // Then cleanup any pending operations
        await this.cleanupPendingOperations();
    }

    async getQueueBacklog(): Promise<number> {
        try {
            const stats = await this.queueService.getQueueStats(this.channel);
            const backlog = Object.values(stats.priorityQueues)
                .reduce((total, queue) => total + queue.size, 0);

            workerMetrics.queueBacklog.set(
                { channel: this.channel },
                backlog
            );

            return backlog;
        } catch (error) {
            workerMetrics.workerErrors.inc({
                channel: this.channel,
                error_type: 'queue_error'
            });
            logger.error('Error getting queue backlog', {
                error: error instanceof Error ? error.message : 'Unknown error',
                channel: this.channel
            });
            return 0;
        }
    }

    isActive(): boolean {
        return this.isRunning;
    }

    protected async startWorkersByPriority(): Promise<void> {
        for (const priority of Object.values(NotificationPriority)) {
            await this.startPriorityWorker(priority);
        }
    }

    protected async startPriorityWorker(priority: NotificationPriority): Promise<void> {
        const workerConfig = config.queue.priorities[priority];
        this.workerInstances.set(priority, true);

        for (let i = 0; i < workerConfig.workerConcurrency; i++) {
            this.processPriorityQueue(priority);
        }
    }

    protected async processPriorityQueue(priority: NotificationPriority): Promise<void> {
        while (this.isRunning && this.workerInstances.get(priority)) {
            try {
                const queuedItem = await this.queueService.getFromQueue(this.channel);
                if (!queuedItem) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                const startTime = Date.now();
                const success = await this.processQueuedItem(queuedItem);
                const duration = Date.now() - startTime;

                this.recordMetrics(priority, success, duration);
            } catch (error) {
                logger.error('Error processing queue', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    channel: this.channel,
                    priority
                });
                await new Promise(resolve => setTimeout(resolve, config.queue.priorities[priority].backoffDelay));
            }
        }
    }

    getProcessingLag(): number {
        return Math.max(0, Date.now() - this.lastProcessedTimestamp) / 1000;
    }
}