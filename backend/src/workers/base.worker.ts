import { NotificationChannel, NotificationRequest, NotificationStatus } from '../types/notification';
import { QueueService } from '../services/queue.service';
import NotificationModel from '../models/notification.model';

export abstract class BaseWorker {
    protected queueService: QueueService;
    protected channel: NotificationChannel;
    protected isRunning: boolean = false;
    protected pollInterval: number = 1000; // 1 second

    constructor(channel: NotificationChannel) {
        this.queueService = new QueueService();
        this.channel = channel;
    }

    abstract processNotification(notification: NotificationRequest): Promise<boolean>;

    async start(): Promise<void> {
        this.isRunning = true;
        while (this.isRunning) {
            try {
                const notification = await this.queueService.getFromQueue(this.channel);

                if (notification) {
                    console.log(`Processing ${this.channel} notification:`, notification.id);

                    try {
                        await this.processNotification(notification);
                        await this.updateNotificationStatus(notification.id!, NotificationStatus.DELIVERED);
                    } catch (error) {
                        console.error(`Failed to process ${this.channel} notification:`, error);
                        await this.updateNotificationStatus(notification.id!, NotificationStatus.FAILED);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, this.pollInterval));
            } catch (error) {
                console.error(`Error in ${this.channel} worker:`, error);
                await new Promise(resolve => setTimeout(resolve, this.pollInterval * 5));
            }
        }
    }

    stop(): void {
        this.isRunning = false;
    }

    protected async updateNotificationStatus(
        notificationId: string,
        status: NotificationStatus,
        errorMessage?: string
    ): Promise<void> {
        try {
            await NotificationModel.findByIdAndUpdate(notificationId, {
                status,
                ...(status === NotificationStatus.DELIVERED && { deliveredAt: new Date() }),
                ...(status === NotificationStatus.FAILED && {
                    failedAt: new Date(),
                    errorMessage
                }),
            });
        } catch (error) {
            console.error('Failed to update notification status:', error);
        }
    }
}