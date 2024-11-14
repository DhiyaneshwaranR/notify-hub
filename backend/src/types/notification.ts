export enum NotificationChannel {
    EMAIL = 'EMAIL',
    SMS = 'SMS',
    PUSH = 'PUSH',
    WEBHOOK = 'WEBHOOK'
}

export enum NotificationStatus {
    PENDING = 'PENDING',
    QUEUED = 'QUEUED',
    SENDING = 'SENDING',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED'
}

export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export interface Recipient {
    id: string;
    channel: NotificationChannel;
    destination: string; // email, phone number, device token, or webhook URL
    metadata?: Record<string, any>;
}

export interface NotificationContent {
    subject?: string;
    body: string;
    templateId?: string;
    templateData?: Record<string, any>;
    actionButton?: {
        text: string;
        url: string;
    };
    attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
    }>;
}

export interface NotificationResponse {
    id: string;
    status: NotificationStatus;
    channel: NotificationChannel | NotificationChannel[];
    createdAt: Date;
    scheduledAt?: Date;
    sentAt?: Date;
    deliveredAt?: Date;
    failedAt?: Date;
    errorMessage?: string;
}

export interface QueuedNotification extends Omit<NotificationRequest, 'channel'> {
    channel: NotificationChannel; // Queue-specific notification always has single channel
    timestamp: string;
}

export interface NotificationMetadata {
    queuedItemId?: string;
    retryAttempt?: number;
    lastAttempt?: Date;
    [key: string]: any;
}

export interface NotificationRequest {
    id?: string;
    channel: NotificationChannel | NotificationChannel[];
    recipients: Array<{
        id: string;
        channel: NotificationChannel;
        destination: string;
        metadata?: Record<string, any>;
    }>;
    content: NotificationContent;
    priority: NotificationPriority;
    scheduledAt?: Date;
    metadata?: NotificationMetadata;
}