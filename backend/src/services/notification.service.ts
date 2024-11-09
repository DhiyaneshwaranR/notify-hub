import { NotificationRequest, NotificationResponse, NotificationStatus } from '../types/notification';
import NotificationModel from '../models/notification.model';
import { NotFoundError, DatabaseError } from '../types/errors';
import { QueueService } from './queue.service';
import logger from '../utils/logger';

class NotificationService {

    private queueService: QueueService;

    constructor() {
        this.queueService = new QueueService();
    }

    async createNotification(request: NotificationRequest): Promise<NotificationResponse> {
        try {
            // Normalize channels to array
            const channels = Array.isArray(request.channel) ? request.channel : [request.channel];

            // Create notification record
            const notification = new NotificationModel({
                channel: channels, // MongoDB will store as array
                recipients: request.recipients,
                content: request.content,
                priority: request.priority,
                scheduledAt: request.scheduledAt,
                metadata: request.metadata,
                status: NotificationStatus.PENDING
            });

            const savedNotification = await notification.save();

            // Add to appropriate queues
            const queueResults = await this.queueService.addToQueue(channels, {
                ...request,
                id: savedNotification._id
            });

            logger.info('Notification queued successfully', {
                notificationId: savedNotification._id,
                channels,
                queueResults
            });

            return {
                id: savedNotification._id,
                status: savedNotification.status,
                channel: savedNotification.channel,
                createdAt: savedNotification.createdAt,
                scheduledAt: savedNotification.scheduledAt,
                sentAt: savedNotification.sentAt,
                deliveredAt: savedNotification.deliveredAt,
                failedAt: savedNotification.failedAt,
                errorMessage: savedNotification.errorMessage
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to create notification', { error: errorMessage });
            throw new DatabaseError(`Failed to create notification: ${errorMessage}`);
        }
    }

    async getNotificationById(id: string): Promise<NotificationResponse> {
        try {
            const notification = await NotificationModel.findById(id);
            if (!notification) {
                throw new NotFoundError(`Notification with id ${id} not found`);
            }

            return {
                id: notification._id.toString(),
                status: notification.status,
                channel: notification.channel,
                createdAt: notification.createdAt,
                scheduledAt: notification.scheduledAt,
                sentAt: notification.sentAt,
                deliveredAt: notification.deliveredAt,
                failedAt: notification.failedAt,
                errorMessage: notification.errorMessage
            };
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new Error(`Failed to get notification: ${error.message}`);
            }
            throw new Error('Failed to get notification: Unknown error occurred');
        }
    }
}

export default new NotificationService();