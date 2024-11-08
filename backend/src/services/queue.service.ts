import Redis from 'ioredis';
import { NotificationRequest, NotificationChannel } from '../types/notification';
import { DatabaseError } from '../types/errors';
import redis from '../config/redis';

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
        channel: NotificationChannel,
        notification: NotificationRequest
    ): Promise<string> {
        try {
            const queueName = this.queues[channel];
            const notificationString = JSON.stringify({
                ...notification,
                timestamp: new Date().toISOString()
            });

            await this.redis.rpush(queueName, notificationString);
            return `Queued in ${queueName}`;
        } catch (error) {
            if (error instanceof Error) {
                throw new DatabaseError(`Failed to add to queue: ${error.message}`);
            }
            throw new DatabaseError('Failed to add to queue: Unknown error');
        }
    }

    async getFromQueue(channel: NotificationChannel): Promise<NotificationRequest | null> {
        try {
            const queueName = this.queues[channel];
            const notification = await this.redis.lpop(queueName);

            if (!notification) return null;

            return JSON.parse(notification);
        } catch (error) {
            if (error instanceof Error) {
                throw new DatabaseError(`Failed to get from queue: ${error.message}`);
            }
            throw new DatabaseError('Failed to get from queue: Unknown error');
        }
    }

    async getQueueLength(channel: NotificationChannel): Promise<number> {
        try {
            const queueName = this.queues[channel];
            return await this.redis.llen(queueName);
        } catch (error) {
            if (error instanceof Error) {
                throw new DatabaseError(`Failed to get queue length: ${error.message}`);
            }
            throw new DatabaseError('Failed to get queue length: Unknown error');
        }
    }
}