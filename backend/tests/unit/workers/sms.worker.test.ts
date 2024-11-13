import { SMSWorker } from '../../../src/workers/sms.worker';
import { SMSService } from '../../../src/services/sms.service';
import { RetryService } from '../../../src/services/retry.service';
import { NotificationChannel, NotificationPriority } from '../../../src/types/notification';
import { createTestNotification } from '../../setup';
import '../../mocks/sms-templates';

// Mock services
jest.mock('../../../src/services/sms.service');
jest.mock('../../../src/services/retry.service');

// Mock metrics
jest.mock('../../../src/monitoring/metrics', () => ({
    workerMetrics: {
        processedNotifications: {
            inc: jest.fn()
        },
        processingTime: {
            observe: jest.fn()
        },
        processingLag: {
            set: jest.fn()
        },
        queueBacklog: {
            set: jest.fn()
        },
        workerStatus: {
            set: jest.fn()
        },
        activeWorkers: {
            set: jest.fn()
        },
        workerErrors: {
            inc: jest.fn()
        },
        initializationTime: {
            observe: jest.fn()
        },
        concurrency: {
            set: jest.fn()
        }
    }
}));

// Get the mocked metrics after mocking
const mockWorkerMetrics = jest.mocked(
    require('../../../src/monitoring/metrics').workerMetrics
);

describe('SMSWorker', () => {
    let worker: SMSWorker;
    let smsServiceMock: jest.Mocked<SMSService>;
    let retryServiceMock: jest.Mocked<RetryService>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        smsServiceMock = {
            sendSMS: jest.fn().mockResolvedValue(true)
        } as unknown as jest.Mocked<SMSService>;

        retryServiceMock = {
            handleFailedNotification: jest.fn()
        } as unknown as jest.Mocked<RetryService>;

        worker = new SMSWorker();
        (worker as any).smsService = smsServiceMock;
        (worker as any).retryService = retryServiceMock;
    });

    afterEach(() => {
        jest.useRealTimers();
    });


    describe('processNotification', () => {
        it('should process notification successfully', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890',
                    metadata: { name: 'Test User' }
                }]
            });

            const result = await worker.processNotification(notification);

            expect(result).toBe(true);
            expect(smsServiceMock.sendSMS).toHaveBeenCalledWith(notification);
            expect(retryServiceMock.handleFailedNotification).not.toHaveBeenCalled();
            expect(mockWorkerMetrics.processedNotifications.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH,
                status: 'success'
            });
            expect(mockWorkerMetrics.processingTime.observe).toHaveBeenCalled();
        });

        it('should handle failed notification', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH
            });

            const error = new Error('SMS sending failed');
            smsServiceMock.sendSMS.mockRejectedValue(error);

            const result = await worker.processNotification(notification);

            expect(result).toBe(false);
            expect(smsServiceMock.sendSMS).toHaveBeenCalledWith(notification);
            expect(retryServiceMock.handleFailedNotification).toHaveBeenCalledWith(
                notification,
                error,
                0
            );
            expect(mockWorkerMetrics.processedNotifications.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH,
                status: 'failure'
            });
        });

        it('should handle retry attempts', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH,
                metadata: { retryAttempt: 2 }
            });

            const error = new Error('SMS sending failed');
            smsServiceMock.sendSMS.mockRejectedValue(error);

            const result = await worker.processNotification(notification);

            expect(result).toBe(false);
            expect(retryServiceMock.handleFailedNotification).toHaveBeenCalledWith(
                notification,
                error,
                2
            );
            expect(mockWorkerMetrics.processedNotifications.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH,
                status: 'failure'
            });
        });
    });

    describe('worker lifecycle', () => {
        it('should start and stop correctly', async () => {
            await worker.start();
            expect(worker['isRunning']).toBe(true);
            expect(mockWorkerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'running' },
                1
            );

            worker.stop();
            expect(worker['isRunning']).toBe(false);
            expect(mockWorkerMetrics.workerStatus.set).toHaveBeenCalledWith(
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
            const error = new Error('Startup error');
            (worker as any).initializeWorker = jest.fn().mockRejectedValue(error);

            await worker.start();

            // tests/unit/workers/sms.worker.test.ts (continued)

            expect(mockWorkerMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'startup'
            });
            expect(mockWorkerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'failed' },
                1
            );
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

            expect(mockWorkerMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'timeout'
            });
        });

        it('should handle service errors gracefully', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS
            });

            const error = new Error('Service error');
            smsServiceMock.sendSMS.mockRejectedValue(error);

            await worker.processNotification(notification);

            expect(mockWorkerMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'service_error'
            });
            expect(retryServiceMock.handleFailedNotification).toHaveBeenCalledWith(
                notification,
                error,
                0
            );
        });

        it('should handle queue errors', async () => {
            const error = new Error('Queue error');
            (worker as any).queueService = {
                getQueueStats: jest.fn().mockRejectedValue(error)
            };

            await worker.getQueueBacklog();

            expect(mockWorkerMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'queue_error'
            });
        });
    });

    describe('priority handling', () => {
        it('should process high priority notifications first', async () => {
            const highPriorityNotification = createTestNotification({
                channel: NotificationChannel.SMS,
                priority: NotificationPriority.HIGH
            });

            await worker.processNotification(highPriorityNotification);

            expect(mockWorkerMetrics.processingTime.observe).toHaveBeenCalledWith(
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
                channel: NotificationChannel.SMS
            });

            await worker.processNotification(notification);

            expect(mockWorkerMetrics.processingTime.observe).toHaveBeenCalled();
            expect(mockWorkerMetrics.processedNotifications.inc).toHaveBeenCalled();
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

            expect(mockWorkerMetrics.queueBacklog.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS },
                5
            );
        });

        it('should track worker status', async () => {
            await worker.start();

            expect(mockWorkerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'running' },
                1
            );

            worker.stop();

            expect(mockWorkerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'stopped' },
                1
            );
        });
    });


    describe('cleanup', () => {
        it('should perform cleanup on stop', () => {
            worker.start();
            worker.stop();

            expect(mockWorkerMetrics.workerStatus.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS, status: 'stopped' },
                1
            );
            expect(mockWorkerMetrics.activeWorkers.set).toHaveBeenCalledWith(
                { channel: NotificationChannel.SMS },
                0
            );
        });

        it('should handle cleanup errors gracefully', () => {
            const error = new Error('Cleanup error');
            (worker as any).cleanup = jest.fn().mockRejectedValue(error);

            worker.stop();

            expect(mockWorkerMetrics.workerErrors.inc).toHaveBeenCalledWith({
                channel: NotificationChannel.SMS,
                error_type: 'cleanup'
            });
        });
    });
});