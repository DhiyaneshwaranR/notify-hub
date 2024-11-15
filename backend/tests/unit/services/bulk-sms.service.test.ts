import { BulkSMSService } from '../../../src/services/bulk-sms.service';
import { SMSService } from '../../../src/services/sms.service';
import { NotificationChannel, NotificationPriority } from '../../../src/types/notification';
import { createTestNotification } from '../../setup';
import { queueMetrics } from '../../../src/monitoring/metrics';
import config from '../../../src/config';

// Mock dependencies
jest.mock('../../../src/services/sms.service');
jest.mock('../../../src/monitoring/metrics', () => ({
    queueMetrics: {
        rateLimits: { set: jest.fn() },
        rateLimitRejections: { inc: jest.fn() },
        concurrentRequests: { set: jest.fn() },
        messageDeliveryTime: { observe: jest.fn() },
        processedNotifications: { inc: jest.fn() },
        messageStatus: {inc: jest.fn()}
    }
}));

// Create Redis mock instance
jest.mock('ioredis', () => require('ioredis-mock'));

describe('BulkSMSService', () => {
    let bulkSMSService: BulkSMSService;
    let smsServiceMock: jest.Mocked<SMSService>;
    let redisMock: any;

    beforeEach(() => {
        jest.clearAllMocks();// Access private redis instance
        jest.useFakeTimers();
        // Setup SMS service mock
        smsServiceMock = {
            sendSMS: jest.fn().mockResolvedValue(true)
        } as any;

        // Initialize service
        bulkSMSService = new BulkSMSService();
        (bulkSMSService as any).smsService = smsServiceMock;

        redisMock = bulkSMSService['redis'];
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    describe('sendBulkSMS', () => {
        // tests/unit/services/bulk-sms.service.test.ts

        it('should process bulk SMS in batches', async () => {
            // Create test data with 5 recipients
            const recipients = Array(5).fill(null).map((_, index) => ({
                id: `recipient-${index}`,
                channel: NotificationChannel.SMS,
                destination: `+1234567${index.toString().padStart(3, '0')}`,
                metadata: { name: `User ${index}` }
            }));

            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients,
                priority: NotificationPriority.HIGH
            });

            // Send bulk SMS
            const batchId = await bulkSMSService.sendBulkSMS(notification);

            expect(batchId).toBeDefined();
            expect(typeof batchId).toBe('string');

            // Get initial progress
            const initialProgress = await bulkSMSService.getBulkStatus(batchId);
            expect(initialProgress).toBeDefined();
            expect(initialProgress?.total).toBe(5);
            expect(initialProgress?.status).toBe('processing');

            // Create a promise that resolves when processing is complete
            const waitForCompletion = async () => {
                const maxAttempts = 100;
                let attempts = 0;
                while (attempts < maxAttempts) {
                    const progress = await bulkSMSService.getBulkStatus(batchId);
                    if (progress?.status !== 'processing') {
                        return progress;
                    }
                    attempts++;
                    jest.advanceTimersByTime(100); // Advance timers by 1 second
                }
                throw new Error('Processing timeout');
            };

            // Wait for processing to complete and get final status
            const finalProgress = await waitForCompletion();

            // Verify SMS service was called
            expect(smsServiceMock.sendSMS).toHaveBeenCalled();

            // Check final progress
            expect(finalProgress?.status).toBe('completed');
            expect(finalProgress?.sent).toBe(5);
            expect(finalProgress?.failed).toBe(0);
        },100000);

        it('should handle failed SMS sending', async () => {
            // Mock SMS service to fail
            smsServiceMock.sendSMS.mockRejectedValue(new Error('SMS sending failed'));

            const recipients = Array(3).fill(null).map((_, index) => ({
                id: `recipient-${index}`,
                channel: NotificationChannel.SMS,
                destination: `+1234567${index.toString().padStart(3, '0')}`,
            }));

            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients
            });

            const batchId = await bulkSMSService.sendBulkSMS(notification);

            // Fast-forward time to complete processing
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            const waitForCompletion = async () => {
                const maxAttempts = 1000;
                let attempts = 0;
                while (attempts < maxAttempts) {
                    const progress = await bulkSMSService.getBulkStatus(batchId);
                    if (progress?.status !== 'processing') {
                        return progress;
                    }
                    attempts++;
                    jest.advanceTimersByTime(100); // Advance timers by 1 second
                }
                throw new Error('Processing timeout');
            };

            // Wait for processing to complete and get final status
            await waitForCompletion();

            const progress = await bulkSMSService.getBulkStatus(batchId);
            expect(progress?.failed).toBeGreaterThan(0);
            expect(progress?.status).toBe('failed');
        },1000000);

        it('should respect rate limits', async () => {
            // Set up rate limit test data
            const rateLimitKey = 'sms:ratelimit:second:' + Math.floor(Date.now() / 1000);
            await redisMock.set(rateLimitKey, config.sms.rateLimit.maxRequestsPerSecond);

            const recipients = Array(3).fill(null).map((_, index) => ({
                id: `recipient-${index}`,
                channel: NotificationChannel.SMS,
                destination: `+1234567${index.toString().padStart(3, '0')}`,
            }));

            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients
            });

            const batchId = await bulkSMSService.sendBulkSMS(notification);

            // Verify rate limit checking
            expect(await redisMock.get(rateLimitKey)).toBeDefined();

            // Fast-forward time
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            const waitForCompletion = async () => {
                const maxAttempts = 1000;
                let attempts = 0;
                while (attempts < maxAttempts) {
                    const progress = await bulkSMSService.getBulkStatus(batchId);
                    if (progress?.status !== 'processing') {
                        return progress;
                    }
                    attempts++;
                    jest.advanceTimersByTime(100); // Advance timers by 1 second
                }
                throw new Error('Processing timeout');
            };

            // Wait for processing to complete and get final status
            await waitForCompletion();

            const progress = await bulkSMSService.getBulkStatus(batchId);
            expect(progress?.status).toBe('completed');
        });

        it('should update metrics', async () => {
            const recipients = Array(2).fill(null).map((_, index) => ({
                id: `recipient-${index}`,
                channel: NotificationChannel.SMS,
                destination: `+1234567${index.toString().padStart(3, '0')}`,
            }));

            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients
            });

            await bulkSMSService.sendBulkSMS(notification);
            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            const waitForCompletion = async () => {
                const maxAttempts = 10000;
                let attempts = 0;
                while (attempts < maxAttempts) {
                    attempts++;
                    jest.advanceTimersByTime(1000); // Advance timers by 1 second
                }
            };

            // Wait for processing to complete and get final status
            await waitForCompletion();

            // Verify metrics were called
            expect(queueMetrics.rateLimits.set).toHaveBeenCalled();

            await waitForCompletion();
            await waitForCompletion();
            expect(queueMetrics.concurrentRequests.set).toHaveBeenCalled();
        },10000);
    });

    describe('getBulkStatus', () => {
        it('should return null for non-existent batch', async () => {
            const status = await bulkSMSService.getBulkStatus('non-existent-id');
            expect(status).toBeNull();
        });

        it('should return progress for existing batch', async () => {
            // Create a batch first
            const recipients = [{
                id: 'test-recipient',
                channel: NotificationChannel.SMS,
                destination: '+12345678900'
            }];

            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients
            });

            const batchId = await bulkSMSService.sendBulkSMS(notification);
            const status = await bulkSMSService.getBulkStatus(batchId);

            expect(status).toBeDefined();
            expect(status?.total).toBe(1);
            expect(status?.batchId).toBe(batchId);
        });
    });
});