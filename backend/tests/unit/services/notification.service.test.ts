// tests/unit/services/notification.service.test.ts
import NotificationService from '../../../src/services/notification.service';
import NotificationModel from '../../../src/models/notification.model';
import { QueueService } from '../../../src/services/queue.service';
import {
    NotificationStatus,
    NotificationChannel
} from '../../../src/types/notification';
import {
    setupTestDB,
    teardownTestDB,
    clearCollections,
    createTestNotification,
    createMultiChannelNotification,
    createScheduledNotification
} from '../../setup';
import {DatabaseError} from '../../../src/types/errors';

jest.mock('../../../src/services/queue.service');

describe('NotificationService', () => {
    beforeAll(async () => {
        await setupTestDB();
    });

    afterAll(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearCollections();
        jest.clearAllMocks();
    });

    describe('createNotification', () => {
        it('should create a notification and add it to queue', async () => {
            const mockQueueAdd = jest.spyOn(QueueService.prototype, 'addToQueue')
                .mockResolvedValue(['Queued in notification:queue:email']);

            const notificationData = createTestNotification();
            const result = await NotificationService.createNotification(notificationData);

            // Check if notification was created in database
            const notification = await NotificationModel.findById(result.id);
            expect(notification).toBeTruthy();
            expect(notification?.status).toBe(NotificationStatus.PENDING);
            expect(notification?.channel).toContain(notificationData.channel);

            // Verify queue service was called
            expect(mockQueueAdd).toHaveBeenCalledTimes(1);
            expect(mockQueueAdd).toHaveBeenCalledWith(
                [notificationData.channel],
                expect.objectContaining({
                    id: result.id,
                    channel: notificationData.channel
                })
            );
        });

        it('should handle multiple channels', async () => {
            const mockQueueAdd = jest.spyOn(QueueService.prototype, 'addToQueue')
                .mockResolvedValue(['Queued in notification:queue:email', 'Queued in notification:queue:sms']);

            const channels = [NotificationChannel.EMAIL, NotificationChannel.SMS];
            const notificationData = createMultiChannelNotification(channels);

            const result = await NotificationService.createNotification(notificationData);
            const notification = await NotificationModel.findById(result.id);

            expect(notification?.channel).toHaveLength(2);
            expect(notification?.channel).toContain(NotificationChannel.EMAIL);
            expect(notification?.channel).toContain(NotificationChannel.SMS);
            expect(mockQueueAdd).toHaveBeenCalledTimes(1);
        });

        it('should handle scheduled notifications', async () => {
            const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
            const notificationData = createScheduledNotification(scheduledDate);

            const result = await NotificationService.createNotification(notificationData);
            const notification = await NotificationModel.findById(result.id);

            expect(notification?.scheduledAt).toEqual(scheduledDate);
        });

        it('should handle database errors gracefully', async () => {
            // Mock mongoose save to throw error
            jest.spyOn(NotificationModel.prototype, 'save')
                .mockRejectedValueOnce(new Error('Database connection lost'));

            const notificationData = createTestNotification();

            await expect(
                NotificationService.createNotification(notificationData)
            ).rejects.toThrow(DatabaseError);
        });
    });

    describe('getNotificationById', () => {
        it('should retrieve an existing notification', async () => {
            const notificationData = createTestNotification();
            const created = await NotificationService.createNotification(notificationData);

            const result = await NotificationService.getNotificationById(created.id);

            expect(result).toBeTruthy();
            expect(result.id).toStrictEqual(created.id);
            expect(result.status).toBe(NotificationStatus.PENDING);
            expect(result.channel).toEqual(expect.arrayContaining([notificationData.channel]));
        });

        it('should throw NotFoundError for non-existent notification', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';

            await expect(
                NotificationService.getNotificationById(nonExistentId)
            ).rejects.toThrow('Notification with id 507f1f77bcf86cd799439011 not found');
        });

        it('should handle invalid ObjectId format', async () => {
            const invalidId = 'invalid-id';

            await expect(
                NotificationService.getNotificationById(invalidId)
            ).rejects.toThrow(DatabaseError);
        });
    });
});