import { NotificationRequest } from '../types/notification';
import { BaseWorker } from './base.worker';
import { NotificationChannel } from '../types/notification';

export class EmailWorker extends BaseWorker {
    constructor() {
        super(NotificationChannel.EMAIL);
    }

    async processNotification(notification: NotificationRequest): Promise<boolean> {
        // This is where you'd implement actual email sending logic
        // For now, we'll simulate email sending
        console.log('Sending email:', notification);

        // Simulate sending delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate success
        return true;
    }
}