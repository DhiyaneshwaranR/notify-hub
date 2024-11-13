import {
    NotificationChannel,
    NotificationRequest,
    NotificationStatus
} from '../types/notification';
import {QueuePriority, QueuedItem, DeadLetterQueueItem, QueueError} from '../types/queue';
import { QueueService } from '../services/queue.service';
import NotificationModel from '../models/notification.model';
import logger from '../utils/logger';
import config from '../config';
import { workerMetrics } from '../monitoring/metrics';

export abstract class BaseWorker {
    protected queueService: QueueService;
    protected channel: NotificationChannel;
    protected isRunning: boolean = false;
    protected workerInstances: Map<QueuePriority, boolean> = new Map();
    private processingItems: Set<string> = new Set();
    private lastProcessedTimestamp: number = Date.now();

    constructor(channel: NotificationChannel) {
        this.queueService = new QueueService();
        this.channel = channel;

        // Initialize worker instances for each priority
        Object.values(QueuePriority).forEach(priority => {
            this.workerInstances.set(priority, false);
        });
    }

    abstract processNotification(notification: NotificationRequest): Promise<boolean>;

    async start(): Promise<void> {
        this.isRunning = true;
        this.lastProcessedTimestamp = Date.now();

        // Start workers for each priority level
        for (const priority of Object.values(QueuePriority)) {
            this.startPriorityWorker(priority);
        }

        logger.info(`Worker started`, {
            channel: this.channel,
            priorities: Array.from(this.workerInstances.keys())
        });
    }

    stop(): void {
        this.isRunning = false;
        Object.values(QueuePriority).forEach(priority => {
            this.workerInstances.set(priority, false);
        });
        logger.info(`Worker stopped`, { channel: this.channel });
    }

    async getQueueBacklog(): Promise<number> {
        try {
            let totalBacklog = 0;
            const stats = await this.queueService.getQueueStats(this.channel);

            Object.values(stats.priorityQueues).forEach(queueStats => {
                totalBacklog += queueStats.size;
            });

            return totalBacklog;
        } catch (error) {
            logger.error('Error getting queue backlog', {
                error: error instanceof Error ? error.message : 'Unknown error',
                channel: this.channel
            });
            return 0;
        }
    }

    getProcessingLag(): number {
        return Math.max(0, Date.now() - this.lastProcessedTimestamp) / 1000;
    }

    isActive(): boolean {
        return this.isRunning;
    }

    private async startPriorityWorker(priority: QueuePriority): Promise<void> {
        const workerConfig = config.queue.priorities[priority];
        this.workerInstances.set(priority, true);

        for (let i = 0; i < workerConfig.workerConcurrency; i++) {
            this.processPriorityQueue(priority);
        }
    }

    private async processPriorityQueue(priority: QueuePriority): Promise<void> {
        const workerConfig = config.queue.priorities[priority];

        while (this.isRunning && this.workerInstances.get(priority)) {
            try {
                const item = await this.queueService.getFromQueue(this.channel);

                if (!item) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                if (this.processingItems.has(item.id)) {
                    logger.warn('Duplicate item detected', { itemId: item.id });
                    continue;
                }

                this.processingItems.add(item.id);

                try {
                    const startTime = Date.now();
                    const success = await this.processNotification(item.data);
                    const processingTime = Date.now() - startTime;

                    workerMetrics.processingTime.observe({
                        channel: this.channel,
                        priority,
                        success: String(success)
                    }, processingTime);

                    if (success) {
                        await this.updateNotificationStatus(item.data.id!, NotificationStatus.DELIVERED);
                        workerMetrics.processedNotifications.inc({
                            channel: this.channel,
                            priority,
                            status: 'success'
                        });
                    } else {
                        await this.handleFailedItem(item, priority, 'Processing failed');
                    }
                } catch (error) {
                    await this.handleFailedItem(
                        item,
                        priority,
                        error instanceof Error ? error.message : 'Unknown error'
                    );
                } finally {
                    this.processingItems.delete(item.id);
                }
            } catch (error) {
                logger.error('Error in priority queue processor', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    channel: this.channel,
                    priority
                });
                await new Promise(resolve => setTimeout(resolve, workerConfig.backoffDelay));
            }
        }
    }

    private async handleFailedItem(
        item: QueuedItem<NotificationRequest>,
        priority: QueuePriority,
        errorMessage: string
    ): Promise<void> {
        const workerConfig = config.queue.priorities[priority];
        item.attemptCount++;
        item.lastAttemptAt = new Date();
        item.error = item.error || [];

        const queueError: QueueError = {
            message: errorMessage,
            timestamp: new Date().toISOString(),
            code: 'PROCESSING_ERROR', // Add appropriate error code
            stack: new Error().stack // Optionally capture stack trace
        };

        item.error.push(queueError);

        if (item.attemptCount >= workerConfig.maxAttempts) {
            await this.queueService.moveToDeadLetterQueue(
                this.channel,
                item,
                `Max attempts (${workerConfig.maxAttempts}) exceeded`
            );
            await this.updateNotificationStatus(
                item.data.id!,
                NotificationStatus.FAILED,
                `Max attempts exceeded: ${errorMessage}`
            );
            workerMetrics.processedNotifications.inc({
                channel: this.channel,
                priority,
                status: 'moved_to_dlq'
            });
        } else {
            // Calculate next attempt time with exponential backoff
            const backoff = workerConfig.backoffDelay * Math.pow(2, item.attemptCount - 1);
            item.nextAttemptAt = new Date(Date.now() + backoff);

            await this.queueService.addToQueue(this.channel, item.data, priority);
            workerMetrics.processedNotifications.inc({
                channel: this.channel,
                priority,
                status: 'retrying'
            });
        }
    }

    // @ts-ignore
    private async startDLQProcessor(): Promise<void> {
        const dlqConfig = config.queue.dlq;

        while (this.isRunning) {
            try {
                await this.queueService.processDeadLetterQueue(
                    this.channel,
                    async (item: DeadLetterQueueItem<NotificationRequest>) => {
                        logger.info('Processing DLQ item', {
                            itemId: item.id,
                            channel: this.channel,
                            originalQueue: item.originalQueue
                        });

                        try {
                            // Attempt to process the failed notification again
                            const success = await this.processNotification(item.data);

                            if (success) {
                                await this.updateNotificationStatus(
                                    item.data.id!,
                                    NotificationStatus.DELIVERED
                                );
                                workerMetrics.processedNotifications.inc({
                                    channel: this.channel,
                                    status: 'dlq_success'
                                });
                            } else {
                                logger.error('Failed to process DLQ item', {
                                    itemId: item.id,
                                    channel: this.channel
                                });
                            }
                        } catch (error) {
                            logger.error('Error processing DLQ item', {
                                error: error instanceof Error ? error.message : 'Unknown error',
                                itemId: item.id,
                                channel: this.channel
                            });
                        }
                    }
                );
            } catch (error) {
                logger.error('Error in DLQ processor', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    channel: this.channel
                });
            }

            // Wait before next DLQ processing cycle
            await new Promise(resolve => setTimeout(resolve, dlqConfig.retryAfter * 1000));
        }
    }

    protected async updateNotificationStatus(
        notificationId: string,
        status: NotificationStatus,
        errorMessage?: string
    ): Promise<void> {
        try {
            await NotificationModel.findByIdAndUpdate(notificationId, {
                status,
                ...(status === NotificationStatus.DELIVERED && { deliveredAt: new Date() }),
                ...(status === NotificationStatus.FAILED && {
                    failedAt: new Date(),
                    errorMessage
                }),
            });
        } catch (error) {
            logger.error('Failed to update notification status:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                notificationId,
                status
            });
        }
    }
}