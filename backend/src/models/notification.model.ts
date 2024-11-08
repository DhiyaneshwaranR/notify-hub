import mongoose, { Schema, Document } from 'mongoose';
import { NotificationChannel, NotificationStatus, NotificationPriority } from '../types/notification';

export interface INotification extends Document {
    channel: NotificationChannel | NotificationChannel[];
    recipients: Array<{
        id: string;
        channel: NotificationChannel;
        destination: string;
        metadata?: Record<string, any>;
    }>;
    content: {
        subject?: string;
        body: string;
        templateId?: string;
        templateData?: Record<string, any>;
        attachments?: Array<{
            filename: string;
            content: string;
            contentType: string;
        }>;
    };
    status: NotificationStatus;
    priority: NotificationPriority;
    scheduledAt?: Date;
    sentAt?: Date;
    deliveredAt?: Date;
    failedAt?: Date;
    errorMessage?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema: Schema = new Schema({
    channel: {
        type: [String],
        enum: Object.values(NotificationChannel),
        required: true
    },
    recipients: [{
        id: { type: String, required: true },
        channel: {
            type: String,
            enum: Object.values(NotificationChannel),
            required: true
        },
        destination: { type: String, required: true },
        metadata: { type: Map, of: Schema.Types.Mixed }
    }],
    content: {
        subject: String,
        body: { type: String, required: true },
        templateId: String,
        templateData: { type: Map, of: Schema.Types.Mixed },
        attachments: [{
            filename: String,
            content: String,
            contentType: String
        }]
    },
    status: {
        type: String,
        enum: Object.values(NotificationStatus),
        default: NotificationStatus.PENDING
    },
    priority: {
        type: String,
        enum: Object.values(NotificationPriority),
        default: NotificationPriority.MEDIUM
    },
    scheduledAt: Date,
    sentAt: Date,
    deliveredAt: Date,
    failedAt: Date,
    errorMessage: String,
    metadata: { type: Map, of: Schema.Types.Mixed },
}, {
    timestamps: true
});

NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ 'recipients.id': 1 });
NotificationSchema.index({ createdAt: 1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);