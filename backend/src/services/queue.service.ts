import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { NotificationRequest, NotificationChannel } from '../types/notification';
import {
    QueuePriority,
    QueuedItem,
    DeadLetterQueueItem,
    QueueStats,
    PriorityQueueStats
} from '../types/queue';
import { DatabaseError } from '../types/errors';
import config from '../config';
import logger from '../utils/logger';
import {queueMetrics, queueSize} from '../monitoring/metrics';

export class QueueService {
    private redis: Redis;
    private readonly queuePrefix = 'notification:queue';
    private readonly dlqPrefix = 'notification:dlq';
    private readonly processingPrefix = 'notification:processing';
    private readonly priorityScores = {
        [QueuePriority.CRITICAL]: 100,
        [QueuePriority.HIGH]: 75,
        [QueuePriority.MEDIUM]: 50,
        [QueuePriority.LOW]: 25,
    };

    constructor() {
        this.redis = new Redis(config.redis);
    }

    private getQueueKey(channel: NotificationChannel, priority: QueuePriority): string {
        return `${this.queuePrefix}:${channel}:${priority}`;
    }

    private getDLQKey(channel: NotificationChannel): string {
        return `${this.dlqPrefix}:${channel}`;
    }

    async addToQueue(
        channels: NotificationChannel | NotificationChannel[],
        notification: NotificationRequest,
        priority: QueuePriority = QueuePriority.MEDIUM
    ): Promise<string[]> {
        const channelArray = Array.isArray(channels) ? channels : [channels];
        const results: string[] = [];

        try {
            const pipeline = this.redis.pipeline();
            const now = new Date();

            for (const channel of channelArray) {
                const queueKey = this.getQueueKey(channel, priority);
                const item: QueuedItem<NotificationRequest> = {
                    id: uuidv4(),
                    data: notification,
                    priority,
                    attemptCount: 0,
                    createdAt: now
                };

                // Add to sorted set with priority score
                pipeline.zadd(queueKey, this.priorityScores[priority], JSON.stringify(item));
                results.push(`Queued in ${queueKey}`);

                // Update queue size metric
                queueSize.inc({ channel });
            }

            await pipeline.exec();
            return results;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to add to queue', { error: errorMessage, channels });
            throw new DatabaseError(`Failed to add to queue: ${errorMessage}`);
        }
    }

    async getFromQueue(channel: NotificationChannel): Promise<QueuedItem<NotificationRequest> | null> {
        try {
            // Try to get items from each priority queue, starting with highest priority
            for (const priority of Object.values(QueuePriority)) {
                const queueKey = this.getQueueKey(channel, priority);

                // Get the first item from the sorted set
                const result = await this.redis
                    .zpopmin(queueKey, 1);

                if (result && result.length >= 2) {
                    const item: QueuedItem<NotificationRequest> = JSON.parse(result[0]);
                    queueSize.dec({ channel });
                    return item;
                }
            }

            return null;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get from queue', { error: errorMessage, channel });
            throw new DatabaseError(`Failed to get from queue: ${errorMessage}`);
        }
    }

    async moveToDeadLetterQueue(
        channel: NotificationChannel,
        item: QueuedItem<NotificationRequest>,
        reason: string
    ): Promise<void> {
        try {
            const dlqKey = this.getDLQKey(channel);
            const dlqItem: DeadLetterQueueItem<NotificationRequest> = {
                ...item,
                originalQueue: this.getQueueKey(channel, item.priority),
                failedAt: new Date(),
                reason
            };

            await this.redis.rpush(dlqKey, JSON.stringify(dlqItem));
            logger.info('Moved item to DLQ', {
                channel,
                itemId: item.id,
                reason
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to move item to DLQ', {
                error: errorMessage,
                channel,
                itemId: item.id
            });
            throw new DatabaseError(`Failed to move item to DLQ: ${errorMessage}`);
        }
    }

    async processDeadLetterQueue(
        channel: NotificationChannel,
        handler: (item: DeadLetterQueueItem<NotificationRequest>) => Promise<void>
    ): Promise<void> {
        const dlqKey = this.getDLQKey(channel);

        try {
            while (true) {
                const itemStr = await this.redis.lpop(dlqKey);
                if (!itemStr) break;

                const item: DeadLetterQueueItem<NotificationRequest> = JSON.parse(itemStr);
                await handler(item);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to process DLQ', { error: errorMessage, channel });
            throw new DatabaseError(`Failed to process DLQ: ${errorMessage}`);
        }
    }

    async getQueueLengths(): Promise<Record<NotificationChannel, Record<QueuePriority, number>>> {
        const lengths: Partial<Record<NotificationChannel, Record<QueuePriority, number>>> = {};

        try {
            for (const channel of Object.values(NotificationChannel)) {
                lengths[channel] = {} as Record<QueuePriority, number>;

                for (const priority of Object.values(QueuePriority)) {
                    const queueKey = this.getQueueKey(channel, priority);
                    // @ts-ignore
                    lengths[channel][priority] = await this.redis.zcard(queueKey);
                }
            }

            return lengths as Record<NotificationChannel, Record<QueuePriority, number>>;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get queue lengths', { error: errorMessage });
            throw new DatabaseError(`Failed to get queue lengths: ${errorMessage}`);
        }
    }

    async cleanupExpiredItems(channel: NotificationChannel): Promise<number> {
        const pipeline = this.redis.pipeline();
        let cleaned = 0;
        const now = Date.now();

        try {
            for (const priority of Object.values(QueuePriority)) {
                const queueKey = this.getQueueKey(channel, priority);
                const ttl = config.queue.channels[channel].priorities[priority].ttl * 1000;

                // Get all items with their scores
                const items = await this.redis.zrangebyscore(
                    queueKey,
                    0,
                    now - ttl,
                    'WITHSCORES'
                );

                for (let i = 0; i < items.length; i += 2) {
                    const item: QueuedItem<NotificationRequest> = JSON.parse(items[i]);

                    // Move to DLQ
                    await this.moveToDeadLetterQueue(
                        channel,
                        item,
                        'TTL exceeded'
                    );

                    // Remove from queue
                    pipeline.zrem(queueKey, items[i]);
                    cleaned++;

                    // Update metrics
                    queueMetrics.expiredItems.inc({
                        channel,
                        priority
                    });
                }
            }

            await pipeline.exec();
            return cleaned;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to cleanup expired items', {
                error: errorMessage,
                channel
            });
            throw new DatabaseError(`Failed to cleanup expired items: ${errorMessage}`);
        }
    }

    private parseQueueItem<T>(itemStr: string): QueuedItem<T> {
        return JSON.parse(itemStr, (_key, value) => {
            const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
            if (typeof value === 'string' && dateFormat.test(value)) {
                return new Date(value);
            }
            return value;
        });
    }

    async requeueStuckItems(channel: NotificationChannel): Promise<number> {
        let requeued = 0;
        const processingSetKey = `${this.processingPrefix}:${channel}`;

        try {
            const items = await this.redis.smembers(processingSetKey);
            const pipeline = this.redis.pipeline();

            for (const itemStr of items) {
                const item = this.parseQueueItem<NotificationRequest>(itemStr);
                const processingTimeout = config.queue.processingTimeout * 1000;

                if (item.lastAttemptAt &&
                    Date.now() - item.lastAttemptAt.getTime() > processingTimeout) {
                    // Add to queue with priority score
                    const queueKey = this.getQueueKey(channel, item.priority);
                    const score = this.priorityScores[item.priority];

                    // Add to queue first
                    await this.redis.zadd(queueKey, score, JSON.stringify({
                        ...item,
                        lastAttemptAt: new Date() // Update last attempt time
                    }));

                    // Remove from processing set
                    pipeline.srem(processingSetKey, itemStr);
                    requeued++;

                    // Update metrics
                    queueMetrics.requeuedItems.inc({
                        channel,
                        priority: item.priority
                    });
                }
            }

            await pipeline.exec();
            return requeued;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to requeue stuck items', {
                error: errorMessage,
                channel
            });
            throw new DatabaseError(`Failed to requeue stuck items: ${errorMessage}`);
        }
    }

    async getQueueStats(channel: NotificationChannel): Promise<QueueStats> {
        try {
            const stats: QueueStats = {
                priorityQueues: {} as Record<QueuePriority, PriorityQueueStats>,
                dlq: {
                    size: 0,
                    oldestItem: null,
                    recentFailures: 0
                },
                processingItems: 0
            };

            // Get stats for each priority queue
            for (const priority of Object.values(QueuePriority)) {
                const queueKey = this.getQueueKey(channel, priority);
                const size = await this.redis.zcard(queueKey);
                const oldestItems = await this.redis.zrange(queueKey, 0, 0);

                stats.priorityQueues[priority] = {
                    size,
                    oldestItem: oldestItems.length ? JSON.parse(oldestItems[0]) : null,
                    processingRate: await this.getProcessingRate(channel, priority),
                    errorRate: await this.getErrorRate(channel, priority)
                };
            }

            // Get DLQ stats
            const dlqKey = this.getDLQKey(channel);
            stats.dlq.size = await this.redis.llen(dlqKey);
            const oldestDlqItem = await this.redis.lindex(dlqKey, 0);
            if (oldestDlqItem) {
                stats.dlq.oldestItem = JSON.parse(oldestDlqItem);
            }
            stats.dlq.recentFailures = await this.getRecentFailures(channel);

            // Get processing items count
            stats.processingItems = await this.redis.scard(
                `${this.processingPrefix}:${channel}`
            );

            return stats;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get queue stats', {
                error: errorMessage,
                channel
            });
            throw new DatabaseError(`Failed to get queue stats: ${errorMessage}`);
        }
    }
    private async getProcessingRate(
        channel: NotificationChannel,
        priority: QueuePriority
    ): Promise<number> {
        const key = `${this.queuePrefix}:${channel}:${priority}:processed`;
        const now = Math.floor(Date.now() / 1000);
        const window = 60; // 1 minute window

        try {
            await this.redis.zremrangebyscore(key, 0, now - window);
            return await this.redis.zcard(key);
        } catch (error) {
            logger.error('Failed to get processing rate', {
                error: error instanceof Error ? error.message : 'Unknown error',
                channel,
                priority
            });
            return 0;
        }
    }

    private async getErrorRate(
        channel: NotificationChannel,
        priority: QueuePriority
    ): Promise<number> {
        const key = `${this.queuePrefix}:${channel}:${priority}:errors`;
        const now = Math.floor(Date.now() / 1000);
        const window = 60; // 1 minute window

        try {
            await this.redis.zremrangebyscore(key, 0, now - window);
            return await this.redis.zcard(key);
        } catch (error) {
            logger.error('Failed to get error rate', {
                error: error instanceof Error ? error.message : 'Unknown error',
                channel,
                priority
            });
            return 0;
        }
    }

    private async getRecentFailures(channel: NotificationChannel): Promise<number> {
        const key = `${this.queuePrefix}:${channel}:failures`;
        const now = Math.floor(Date.now() / 1000);
        const window = 300; // 5 minute window

        try {
            await this.redis.zremrangebyscore(key, 0, now - window);
            return await this.redis.zcard(key);
        } catch (error) {
            logger.error('Failed to get recent failures', {
                error: error instanceof Error ? error.message : 'Unknown error',
                channel
            });
            return 0;
        }
    }
}