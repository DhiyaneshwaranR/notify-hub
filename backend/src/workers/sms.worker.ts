import { SMSService } from '../services/sms.service';
import { RetryService } from '../services/retry.service';
import { BaseWorker } from './base.worker';
import { NotificationChannel, NotificationRequest } from '../types/notification';
import { workerMetrics } from '../monitoring/metrics';
import logger from '../utils/logger';

export class SMSWorker extends BaseWorker {
    private smsService: SMSService;
    private retryService: RetryService;

    constructor() {
        super(NotificationChannel.SMS);
        this.smsService = new SMSService();
        this.retryService = new RetryService();
    }

    public async processNotification(notification: NotificationRequest): Promise<boolean> {
        const timeoutPromise = new Promise<boolean>((_, reject) => {
            setTimeout(() => {
                reject(new Error('Processing timeout'));
            }, this.processingTimeout);
        });

        try {
            const processingPromise = this.smsService.sendSMS(notification);
            await Promise.race([processingPromise, timeoutPromise]);

            // Log success
            logger.info('SMS processed successfully', {
                notificationId: notification.id,
                queuedItemId: notification.metadata?.queuedItemId,
                attempt: notification.metadata?.retryAttempt || 0
            });

            return true;
        } catch (error) {
            const errorType = error instanceof Error && error.message === 'Processing timeout'
                ? 'timeout'
                : 'service_error';

            // Record error metric
            workerMetrics.workerErrors.inc({
                channel: this.channel,
                error_type: errorType
            });

            // Handle retry
            await this.retryService.handleFailedNotification(
                notification,
                error instanceof Error ? error : new Error('Unknown error'),
                notification.metadata?.retryAttempt || 0
            );

            throw error; // Let base worker handle failure metrics
        }
    }

    protected async cleanup(): Promise<void> {
        try {
            await super.cleanup();
        } catch (error) {
            workerMetrics.workerErrors.inc({
                channel: this.channel,
                error_type: 'cleanup'
            });
            throw error;
        }
    }
}