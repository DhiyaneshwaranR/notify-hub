import Redis from 'ioredis';
import { NotificationRequest, NotificationChannel } from '../types/notification';
import { DatabaseError } from '../types/errors';
import redis from '../config/redis';
import logger from '../utils/logger';

export class QueueService {
    private redis: Redis;
    private queues: {
        [key in NotificationChannel]: string;
    };

    constructor() {
        this.redis = redis;
        this.queues = {
            [NotificationChannel.EMAIL]: 'notification:queue:email',
            [NotificationChannel.SMS]: 'notification:queue:sms',
            [NotificationChannel.PUSH]: 'notification:queue:push',
            [NotificationChannel.WEBHOOK]: 'notification:queue:webhook'
        };
    }

    async addToQueue(
        channels: NotificationChannel | NotificationChannel[],
        notification: NotificationRequest
    ): Promise<string[]> {
        try {
            // Convert single channel to array for consistent handling
            const channelArray = Array.isArray(channels) ? channels : [channels];
            const results: string[] = [];

            for (const channel of channelArray) {
                const queueName = this.queues[channel];
                if (!queueName) {
                    logger.warn('Invalid channel type encountered', { channel });
                    continue;
                }

                const notificationString = JSON.stringify({
                    ...notification,
                    channel, // Ensure single channel is stored for the specific queue
                    timestamp: new Date().toISOString()
                });

                await this.redis.rpush(queueName, notificationString);
                results.push(`Queued in ${queueName}`);
            }

            return results;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to add to queue', { error: errorMessage });
            throw new DatabaseError(`Failed to add to queue: ${errorMessage}`);
        }
    }

    async getFromQueue(channel: NotificationChannel): Promise<NotificationRequest | null> {
        try {
            const queueName = this.queues[channel];
            if (!queueName) {
                throw new Error(`Invalid channel type: ${channel}`);
            }

            const notification = await this.redis.lpop(queueName);
            if (!notification) return null;

            return JSON.parse(notification);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get from queue', { error: errorMessage, channel });
            throw new DatabaseError(`Failed to get from queue: ${errorMessage}`);
        }
    }

    async getQueueLength(channel: NotificationChannel): Promise<number> {
        try {
            const queueName = this.queues[channel];
            if (!queueName) {
                throw new Error(`Invalid channel type: ${channel}`);
            }

            return await this.redis.llen(queueName);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get queue length', { error: errorMessage, channel });
            throw new DatabaseError(`Failed to get queue length: ${errorMessage}`);
        }
    }

    async getQueueLengths(): Promise<Record<NotificationChannel, number>> {
        try {
            const lengths: Partial<Record<NotificationChannel, number>> = {};

            for (const channel of Object.values(NotificationChannel)) {
                lengths[channel] = await this.getQueueLength(channel);
            }

            return lengths as Record<NotificationChannel, number>;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get queue lengths', { error: errorMessage });
            throw new DatabaseError(`Failed to get queue lengths: ${errorMessage}`);
        }
    }
}