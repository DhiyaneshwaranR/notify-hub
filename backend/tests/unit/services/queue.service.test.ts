import { QueueService } from '../../../src/services/queue.service';
import { NotificationChannel, NotificationRequest } from '../../../src/types/notification';
import { QueuePriority, QueuedItem } from '../../../src/types/queue';
import { DatabaseError } from '../../../src/types/errors';
import { mockRedis, createTestNotification } from '../../setup';
import { queueMetrics } from '../../../src/monitoring/metrics';
import {register} from "prom-client";

// Helper function to parse dates in JSON
function reviveDates(_key: string, value: any) {
    const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    if (typeof value === 'string' && dateFormat.test(value)) {
        return new Date(value);
    }
    return value;
}

// Mock Redis
jest.mock('ioredis', () => require('ioredis-mock'));
jest.mock('../../../src/monitoring/metrics', () => ({
    queueMetrics: {
        expiredItems: { inc: jest.fn() },
        requeuedItems: { inc: jest.fn() },
        rateLimit: { set: jest.fn() }
    },
    queueSize: {
        inc: jest.fn(),
        dec: jest.fn()
    }
}));

describe('QueueService', () => {
    let queueService: QueueService;
    let redisMock: any;

    beforeAll(() => {
        register.clear();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockRedis.flushall();
        register.resetMetrics();
        queueService = new QueueService();
        redisMock = queueService['redis']; // Access private redis instance
    });

    describe('addToQueue', () => {
        it('should add a notification to the queue with correct priority', async () => {
            const notification = createTestNotification();
            const result = await queueService.addToQueue(
                NotificationChannel.EMAIL,
                notification,
                QueuePriority.HIGH
            );

            expect(result).toHaveLength(1);
            expect(result[0]).toContain('Queued in notification:queue:EMAIL:HIGH');

            // Verify the item was added to Redis
            const queueKey = `notification:queue:${NotificationChannel.EMAIL}:${QueuePriority.HIGH}`;
            const queueItems = await mockRedis.zrange(queueKey, 0, -1);
            expect(queueItems).toHaveLength(1);

            const queuedItem = JSON.parse(queueItems[0]);
            expect(queuedItem.data).toEqual(expect.objectContaining({
                channel: notification.channel,
                recipients: notification.recipients
            }));
            expect(queuedItem.priority).toBe(QueuePriority.HIGH);
        });

        it('should handle multiple channels', async () => {
            const notification = createTestNotification();
            const channels = [NotificationChannel.EMAIL, NotificationChannel.SMS];

            const result = await queueService.addToQueue(
                channels,
                notification,
                QueuePriority.MEDIUM
            );

            expect(result).toHaveLength(2);
            expect(result[0]).toContain('EMAIL:MEDIUM');
            expect(result[1]).toContain('SMS:MEDIUM');

            // Verify items in both queues
            for (const channel of channels) {
                const queueKey = `notification:queue:${channel}:${QueuePriority.MEDIUM}`;
                const queueItems = await mockRedis.zrange(queueKey, 0, -1);
                expect(queueItems).toHaveLength(1);
            }
        });

        it('should use default MEDIUM priority when not specified', async () => {
            const notification = createTestNotification();
            await queueService.addToQueue(NotificationChannel.EMAIL, notification);

            const queueKey = `notification:queue:${NotificationChannel.EMAIL}:${QueuePriority.MEDIUM}`;
            const queueItems = await mockRedis.zrange(queueKey, 0, -1);
            expect(queueItems).toHaveLength(1);

            const queuedItem = JSON.parse(queueItems[0]);
            expect(queuedItem.priority).toBe(QueuePriority.MEDIUM);
        });

        it('should handle database errors gracefully', async () => {
            // Mock the pipeline execution to fail
            jest.spyOn(redisMock, 'pipeline').mockReturnValue({
                zadd: jest.fn().mockReturnThis(),
                exec: jest.fn().mockRejectedValueOnce(new Error('Redis connection error'))
            });

            const notification = createTestNotification();
            await expect(
                queueService.addToQueue(NotificationChannel.EMAIL, notification)
            ).rejects.toThrow(DatabaseError);
        });
    });

    describe('getFromQueue', () => {
        it('should retrieve items in priority order', async () => {
            const notification = createTestNotification();

            // Add items with different priorities
            await queueService.addToQueue(NotificationChannel.EMAIL, notification, QueuePriority.LOW);
            await queueService.addToQueue(NotificationChannel.EMAIL, notification, QueuePriority.HIGH);
            await queueService.addToQueue(NotificationChannel.EMAIL, notification, QueuePriority.MEDIUM);

            // Should get HIGH priority first
            const item1 = await queueService.getFromQueue(NotificationChannel.EMAIL);
            expect(item1?.priority).toBe(QueuePriority.HIGH);

            // Then MEDIUM
            const item2 = await queueService.getFromQueue(NotificationChannel.EMAIL);
            expect(item2?.priority).toBe(QueuePriority.MEDIUM);

            // Then LOW
            const item3 = await queueService.getFromQueue(NotificationChannel.EMAIL);
            expect(item3?.priority).toBe(QueuePriority.LOW);
        });

        it('should return null when queue is empty', async () => {
            const result = await queueService.getFromQueue(NotificationChannel.EMAIL);
            expect(result).toBeNull();
        });

        it('should handle corrupt queue data', async () => {
            const queueKey = `notification:queue:${NotificationChannel.EMAIL}:${QueuePriority.HIGH}`;
            await redisMock.zadd(queueKey, 100, 'invalid-json{');

            await expect(
                queueService.getFromQueue(NotificationChannel.EMAIL)
            ).rejects.toThrow(DatabaseError);
        });
    });

    describe('moveToDeadLetterQueue', () => {
        it('should move failed items to DLQ with metadata', async () => {
            const notification = createTestNotification();
            const queuedItem: QueuedItem<NotificationRequest> = {
                id: 'test-id',
                data: notification,
                priority: QueuePriority.HIGH,
                attemptCount: 3,
                createdAt: new Date(),
                error: [{
                    message: 'Previous error',
                    timestamp: new Date().toISOString()
                }]
            };

            await queueService.moveToDeadLetterQueue(
                NotificationChannel.EMAIL,
                queuedItem,
                'Max retries exceeded'
            );

            const dlqKey = `notification:dlq:${NotificationChannel.EMAIL}`;
            const dlqItems = await mockRedis.lrange(dlqKey, 0, -1);
            expect(dlqItems).toHaveLength(1);

            const dlqItem = JSON.parse(dlqItems[0]);
            expect(dlqItem).toMatchObject({
                id: queuedItem.id,
                originalQueue: expect.stringContaining('notification:queue:EMAIL:HIGH'),
                reason: 'Max retries exceeded',
                attemptCount: 3
            });
        });

        it('should handle DLQ errors gracefully', async () => {
            // Mock rpush to fail
            jest.spyOn(redisMock, 'rpush').mockRejectedValueOnce(new Error('Redis error'));

            const queuedItem: QueuedItem<NotificationRequest> = {
                id: 'test-id',
                data: createTestNotification(),
                priority: QueuePriority.HIGH,
                attemptCount: 3,
                createdAt: new Date()
            };

            await expect(
                queueService.moveToDeadLetterQueue(
                    NotificationChannel.EMAIL,
                    queuedItem,
                    'Test reason'
                )
            ).rejects.toThrow(DatabaseError);
        });
    });

    describe('cleanupExpiredItems', () => {
        it('should clean up expired items across all priorities', async () => {
            const notification = createTestNotification();
            const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

            // Add expired items with old timestamps
            for (const priority of Object.values(QueuePriority)) {
                const queuedItem: QueuedItem<NotificationRequest> = {
                    id: `test-id-${priority}`,
                    data: notification,
                    priority,
                    attemptCount: 0,
                    createdAt: oldDate
                };

                const queueKey = `notification:queue:${NotificationChannel.EMAIL}:${priority}`;
                await mockRedis.zadd(
                    queueKey,
                    oldDate.getTime(),
                    JSON.stringify(queuedItem)
                );
            }

            const cleanedCount = await queueService.cleanupExpiredItems(NotificationChannel.EMAIL);
            expect(cleanedCount).toBe(4); // One for each priority level

            // Verify metrics were updated
            expect(queueMetrics.expiredItems.inc).toHaveBeenCalledTimes(4);
        });

        it('should not clean up non-expired items', async () => {
            const notification = createTestNotification();
            const queuedItem: QueuedItem<NotificationRequest> = {
                id: 'test-id',
                data: notification,
                priority: QueuePriority.HIGH,
                attemptCount: 0,
                createdAt: new Date() // Current timestamp
            };

            const queueKey = `notification:queue:${NotificationChannel.EMAIL}:${QueuePriority.HIGH}`;
            await mockRedis.zadd(
                queueKey,
                Date.now(),
                JSON.stringify(queuedItem)
            );

            const cleanedCount = await queueService.cleanupExpiredItems(NotificationChannel.EMAIL);
            expect(cleanedCount).toBe(0);
        });
    });

    describe('requeueStuckItems', () => {
        it('should requeue items stuck in processing', async () => {
            const notification = createTestNotification();
            const stuckTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago

            const stuckItem: QueuedItem<NotificationRequest> = {
                id: 'stuck-id',
                data: notification,
                priority: QueuePriority.HIGH,
                attemptCount: 1,
                createdAt: new Date(),
                lastAttemptAt: stuckTime
            };

            // Add item ONLY to processing set, not to queue
            const processingKey = `notification:processing:${NotificationChannel.EMAIL}`;
            await redisMock.sadd(processingKey, JSON.stringify(stuckItem));

            const requeuedCount = await queueService.requeueStuckItems(NotificationChannel.EMAIL);
            expect(requeuedCount).toBe(1);

            // Verify item was requeued
            const queueKey = `notification:queue:${NotificationChannel.EMAIL}:${QueuePriority.HIGH}`;
            const queueItems = await redisMock.zrange(queueKey, 0, -1);
            expect(queueItems).toHaveLength(1);

            // Verify the item is no longer in the processing set
            const processingItems = await redisMock.smembers(processingKey);
            expect(processingItems).toHaveLength(0);

            // Parse and verify the requeued item
            const requeuedItem = JSON.parse(queueItems[0], reviveDates);
            expect(requeuedItem.id).toBe('stuck-id');
            expect(requeuedItem.priority).toBe(QueuePriority.HIGH);
            expect(new Date(requeuedItem.lastAttemptAt)).toBeInstanceOf(Date);
            expect(new Date(requeuedItem.createdAt)).toBeInstanceOf(Date);

            // Verify metrics were updated
            expect(queueMetrics.requeuedItems.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.EMAIL,
                priority: QueuePriority.HIGH
            });
        });

        it('should not requeue recently processed items', async () => {
            const notification = createTestNotification();
            const recentItem: QueuedItem<NotificationRequest> = {
                id: 'recent-id',
                data: notification,
                priority: QueuePriority.HIGH,
                attemptCount: 1,
                createdAt: new Date(),
                lastAttemptAt: new Date() // Just now
            };

            const processingKey = `notification:processing:${NotificationChannel.EMAIL}`;
            await redisMock.sadd(processingKey, JSON.stringify(recentItem));

            const requeuedCount = await queueService.requeueStuckItems(NotificationChannel.EMAIL);
            expect(requeuedCount).toBe(0);

            // Verify item is still in processing set
            const processingItems = await redisMock.smembers(processingKey);
            expect(processingItems).toHaveLength(1);

            // Verify queue is empty
            const queueKey = `notification:queue:${NotificationChannel.EMAIL}:${QueuePriority.HIGH}`;
            const queueItems = await redisMock.zrange(queueKey, 0, -1);
            expect(queueItems).toHaveLength(0);
        });
    });
});