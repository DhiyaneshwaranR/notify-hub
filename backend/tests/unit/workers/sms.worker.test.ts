const mockMetrics = {
    processedNotifications: { inc: jest.fn() },
    processingTime: { observe: jest.fn() },
    workerStatus: { set: jest.fn() },
    activeWorkers: { set: jest.fn() },
    workerErrors: { inc: jest.fn() },
    queueBacklog: { set: jest.fn() },
    testErrors: { inc: jest.fn() },
};

jest.mock('../../../src/monitoring/metrics', () => ({
    workerMetrics: mockMetrics
}));

import { SMSWorker } from '../../../src/workers/sms.worker';
import { SMSService } from '../../../src/services/sms.service';
import { RetryService } from '../../../src/services/retry.service';
import { NotificationChannel, NotificationPriority } from '../../../src/types/notification';
import { createTestNotification } from '../../setup';
import {workerMetrics} from "../../../src/monitoring/metrics";

// Mock services
jest.mock('../../../src/services/sms.service');
jest.mock('../../../src/services/retry.service');
jest.mock('../../../src/services/queue.service');

describe('SMSWorker', () => {
    let worker: SMSWorker;
    let smsServiceMock: jest.Mocked<SMSService>;
    let retryServiceMock: jest.Mocked<RetryService>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Set up service mocks
        smsServiceMock = {
            sendSMS: jest.fn().mockResolvedValue(true)
        } as any;

        retryServiceMock = {
            handleFailedNotification: jest.fn()
        } as any;

        // Create worker with mocked services
        worker = new SMSWorker();
        (worker as any).smsService = smsServiceMock;
        (worker as any).retryService = retryServiceMock;
    });

    describe('processNotification', () => {
        it('should process notification successfully', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH,
                metadata: {
                    queuedItemId: 'test-queue-id',
                    retryAttempt: 0
                }
            });

            const queuedItem = {
                id: 'test-queue-id',
                data: notification,
                priority: NotificationPriority.HIGH,
                attemptCount: 0,
                createdAt: new Date()
            };

            await worker.start();
            const result = await (worker as any).processQueuedItem(queuedItem);

            expect(result).toBe(true);
            expect(smsServiceMock.sendSMS).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...notification,
                    metadata: expect.objectContaining({
                        queuedItemId: 'test-queue-id',
                        retryAttempt: 0
                    })
                })
            );

            expect(mockMetrics.processedNotifications.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH,
                status: 'success'
            });
        });

        it('should handle timeouts', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH
            });

            // Simulate timeout with proper Promise typing
            smsServiceMock.sendSMS.mockImplementation(() =>
                new Promise<boolean>((resolve) => {
                    setTimeout(() => {
                        resolve(true);
                    }, 40000);
                })
            );

            const queuedItem = {
                id: 'test-queue-id',
                data: notification,
                priority: NotificationPriority.HIGH,
                attemptCount: 0,
                createdAt: new Date()
            };

            await worker.start();
            const processPromise = (worker as any).processQueuedItem(queuedItem);

            // Advance timers to trigger timeout
            jest.advanceTimersByTime(35000);

            await expect(processPromise).rejects.toThrow('Processing timeout');

            expect(mockMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'timeout'
            });
        });

        it('should handle failed notification', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH
            });

            const error = new Error('SMS sending failed');
            smsServiceMock.sendSMS.mockRejectedValue(error);

            const queuedItem = {
                id: 'test-queue-id',
                data: notification,
                priority: NotificationPriority.HIGH,
                attemptCount: 0,
                createdAt: new Date()
            };

            await worker.start();
            await expect((worker as any).processQueuedItem(queuedItem))
                .rejects.toThrow('SMS sending failed');

            expect(mockMetrics.processedNotifications.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH,
                status: 'failure'
            });

            expect(mockMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'service_error'
            });
        });
    });

    describe('worker lifecycle', () => {
        it('should start and stop correctly', async () => {
            await worker.start();
            expect(worker['isRunning']).toBe(true);
            expect(workerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'running' },
                1
            );

            worker.stop();
            expect(worker['isRunning']).toBe(false);
            expect(workerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'stopped' },
                1
            );
        });

        it('should initialize worker instances for all priorities', async () => {
            await worker.start();
            const workerInstances = worker['workerInstances'];
            expect(workerInstances.size).toBe(Object.keys(NotificationPriority).length);
            workerInstances.forEach((isRunning) => {
                expect(isRunning).toBe(true);
            });
        });

        it('should handle start-up errors gracefully', async () => {
            const startupError = new Error('Startup failed');
            jest.spyOn(worker as any, 'startWorkersByPriority')
                .mockRejectedValueOnce(startupError);

            await expect(worker.start()).rejects.toThrow(startupError);

            expect(mockMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'startup'
            });
        });
    });

    describe('error handling', () => {
        it('should handle processing timeouts', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS
            });

            // Simulate a long-running operation that will timeout
            smsServiceMock.sendSMS.mockImplementation(() =>
                new Promise((resolve) => {
                    setTimeout(() => resolve(true), 30000);
                })
            );

            const processPromise = worker.processNotification(notification);

            // Advance timers to trigger timeout
            jest.advanceTimersByTime(30000);

            await expect(processPromise).rejects.toThrow('Processing timeout');

            expect(workerMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'timeout'
            });
        });

        it('should handle service errors gracefully', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH
            });

            const serviceError = new Error('Service error');
            smsServiceMock.sendSMS.mockRejectedValueOnce(serviceError);

            const queuedItem = {
                id: 'test-queue-id',
                data: notification,
                priority: NotificationPriority.HIGH,
                attemptCount: 0,
                createdAt: new Date()
            };

            await expect((worker as any).processQueuedItem(queuedItem))
                .rejects.toThrow(serviceError);

            expect(mockMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'service_error'
            });
        });

        it('should handle queue errors', async () => {
            const error = new Error('Queue error');
            (worker as any).queueService = {
                getQueueStats: jest.fn().mockRejectedValue(error)
            };

            await worker.getQueueBacklog();

            expect(workerMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'queue_error'
            });
        });
    });

    describe('priority handling', () => {
        it('should process high priority notifications first', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH
            });

            const queuedItem = {
                id: 'test-queue-id',
                data: notification,
                priority: NotificationPriority.HIGH,
                attemptCount: 0,
                createdAt: new Date()
            };

            await worker.start();
            await (worker as any).processQueuedItem(queuedItem);

            expect(mockMetrics.processingTime.observe).toHaveBeenCalledWith(
                {
                    channel: NotificationChannel.SMS,
                    priority: NotificationPriority.HIGH,
                    success: 'true'
                },
                expect.any(Number)
            );
        });
    });

    describe('monitoring', () => {
        it('should track processing metrics', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH
            });

            const queuedItem = {
                id: 'test-queue-id',
                data: notification,
                priority: NotificationPriority.HIGH,
                attemptCount: 0,
                createdAt: new Date()
            };

            await worker.start();
            await (worker as any).processQueuedItem(queuedItem);

            expect(mockMetrics.processingTime.observe).toHaveBeenCalled();
            expect(mockMetrics.processedNotifications.inc).toHaveBeenCalled();
        });

        it('should update queue metrics', async () => {
            (worker as any).queueService = {
                getQueueStats: jest.fn().mockResolvedValue({
                    priorityQueues: {
                        [NotificationPriority.HIGH]: { size: 5 }
                    }
                })
            };

            await worker.getQueueBacklog();

            expect(workerMetrics.queueBacklog.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS },
                5
            );
        });

        it('should track worker status', async () => {
            await worker.start();

            expect(workerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'running' },
                1
            );

            worker.stop();

            expect(workerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'stopped' },
                1
            );
        });
    });


    describe('cleanup', () => {
        it('should perform cleanup on stop', () => {
            worker.start();
            worker.stop();

            expect(workerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'stopped' },
                1
            );
            expect(workerMetrics.activeWorkers.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS },
                0
            );
        });

        it('should handle cleanup errors gracefully', async () => {
            // Create a promise to track when cleanup completes
            let cleanupPromiseResolve: (value: unknown) => void;
            const cleanupPromise = new Promise(resolve => {
                cleanupPromiseResolve = resolve;
            });

            // Mock cleanup to throw error and signal completion
            const cleanupError = new Error('Cleanup failed');
            jest.spyOn(worker as any, 'cleanup').mockImplementation(async () => {
                try {
                    throw cleanupError;
                } finally {
                    cleanupPromiseResolve(undefined);
                }
            });

            // Stop worker and wait for cleanup to complete
            worker.stop();
            await cleanupPromise;

            // Now check if error was handled correctly
            expect(mockMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'cleanup'
            });
        });

        // Alternative implementation using flushPromises
        it('should handle cleanup errors gracefully (alternative)', async () => {
            const cleanupError = new Error('Cleanup failed');
            jest.spyOn(worker as any, 'cleanup').mockRejectedValue(cleanupError);

            worker.stop();

            // Flush all pending promises
            await Promise.resolve();
            await Promise.resolve();

            expect(mockMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'cleanup'
            });
        });
    });
});