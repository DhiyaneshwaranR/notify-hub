import { NotificationRequest, NotificationStatus } from '../types/notification';
import { QueueService } from './queue.service';
import logger from '../utils/logger';
import NotificationModel from "../models/notification.model";
import config from '../config';


export class RetryService {
    private maxRetries: number;
    private retryDelays: number[]; // in milliseconds
    private queueService: QueueService;

    constructor() {
        this.maxRetries = config.retry.maxAttempts;
        this.retryDelays = [1000, 5000, 15000, 30000, 60000]; // Exponential backoff
        this.queueService = new QueueService();
    }

    async handleFailedNotification(
        notification: NotificationRequest,
        error: Error,
        attemptNumber: number
    ): Promise<void> {
        if (attemptNumber >= this.maxRetries) {
            logger.error('Max retries exceeded', {
                notificationId: notification.id,
                attempts: attemptNumber,
                error: error.message
            });

            await this.markNotificationFailed(notification.id!, error.message);
            return;
        }

        const delay = this.retryDelays[attemptNumber] || this.retryDelays[this.retryDelays.length - 1];
        await this.scheduleRetry(notification, delay, attemptNumber + 1);
    }

    private async scheduleRetry(
        notification: NotificationRequest,
        delay: number,
        attemptNumber: number
    ): Promise<void> {
        const retryNotification = {
            ...notification,
            metadata: {
                ...notification.metadata,
                retryAttempt: attemptNumber,
                originalId: notification.id
            }
        };

        setTimeout(async () => {
            try {
                await this.queueService.addToQueue(notification.channel, retryNotification);
                logger.info('Scheduled retry', {
                    notificationId: notification.id,
                    attempt: attemptNumber,
                    delay
                });
            } catch (error) {
                logger.error('Failed to schedule retry', {
                    notificationId: notification.id,
                    attempt: attemptNumber,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }, delay);
    }

    private async markNotificationFailed(
        notificationId: string,
        errorMessage: string
    ): Promise<void> {
        try {
            await NotificationModel.findByIdAndUpdate(notificationId, {
                status: NotificationStatus.FAILED,
                failedAt: new Date(),
                errorMessage: errorMessage
            });
        } catch (error) {
            logger.error('Failed to update notification status', {
                notificationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}