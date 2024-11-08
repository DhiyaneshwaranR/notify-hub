import { NotificationRequest, NotificationResponse, NotificationStatus } from '../types/notification';
import NotificationModel from '../models/notification.model';
import { NotFoundError, DatabaseError } from '../types/errors';
import { QueueService } from './queue.service';

class NotificationService {

    private queueService: QueueService;

    constructor() {
        this.queueService = new QueueService();
    }

    async createNotification(request: NotificationRequest): Promise<NotificationResponse> {
        try {
            const notification = new NotificationModel({
                channel: request.channel,
                recipients: request.recipients,
                content: request.content,
                priority: request.priority,
                scheduledAt: request.scheduledAt,
                metadata: request.metadata,
                status: NotificationStatus.PENDING
            });

            const savedNotification = await notification.save();

            // Add to appropriate queues
            const channels = Array.isArray(request.channel) ? request.channel : [request.channel];
            await Promise.all(
                channels.map(channel =>
                    this.queueService.addToQueue(channel, {
                        ...request,
                        id: savedNotification._id
                    })
                )
            );

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
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new DatabaseError(`Failed to create notification: ${error.message}`);
            }
            throw new DatabaseError('Failed to create notification: Unknown error occurred');
        }
    }

    async getNotificationById(id: string): Promise<NotificationResponse> {
        try {
            const notification = await NotificationModel.findById(id);
            if (!notification) {
                throw new NotFoundError('Notification not found');
            }

            return {
                id: notification._id,
                status: notification.status,
                channel: notification.channel,
                createdAt: notification.createdAt,
                scheduledAt: notification.scheduledAt,
                sentAt: notification.sentAt,
                deliveredAt: notification.deliveredAt,
                failedAt: notification.failedAt,
                errorMessage: notification.errorMessage
            };
        } catch (error: unknown) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new DatabaseError(`Failed to get notification: ${error.message}`);
            }
            throw new DatabaseError('Failed to get notification: Unknown error occurred');
        }
    }
}

export default new NotificationService();