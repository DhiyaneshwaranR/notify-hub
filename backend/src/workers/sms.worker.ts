import { SMSService } from '../services/sms.service';
import { RetryService } from '../services/retry.service';
import { BaseWorker } from './base.worker';
import { NotificationChannel, NotificationRequest } from '../types/notification';
import logger from '../utils/logger';

export class SMSWorker extends BaseWorker {
    private smsService: SMSService;
    private retryService: RetryService;

    constructor() {
        super(NotificationChannel.SMS);
        this.smsService = new SMSService();
        this.retryService = new RetryService();
    }

    async processNotification(notification: NotificationRequest): Promise<boolean> {
        const attemptNumber = notification.metadata?.retryAttempt || 0;

        try {
            await this.smsService.sendSMS(notification);
            logger.info('SMS processed successfully', {
                notificationId: notification.id,
                attempt: attemptNumber
            });
            return true;
        } catch (error) {
            await this.retryService.handleFailedNotification(
                notification,
                error instanceof Error ? error : new Error('Unknown error'),
                attemptNumber
            );
            return false;
        }
    }
}