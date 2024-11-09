import { EmailService } from '../services/email.service';
import { RetryService } from '../services/retry.service';
import logger from '../utils/logger';
import {BaseWorker} from "../workers/base.worker";
import {NotificationChannel, NotificationRequest} from "../types/notification";

export class EmailWorker extends BaseWorker {
    private emailService: EmailService;
    private retryService: RetryService;

    constructor() {
        super(NotificationChannel.EMAIL);
        this.emailService = new EmailService();
        this.retryService = new RetryService();
    }

    async processNotification(notification: NotificationRequest): Promise<boolean> {
        const attemptNumber = notification.metadata?.retryAttempt || 0;

        try {
            await this.emailService.sendEmail(notification);
            logger.info('Email processed successfully', {
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