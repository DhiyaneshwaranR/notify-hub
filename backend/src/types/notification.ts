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
    attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
    }>;
}

export interface NotificationRequest {
    id: string;
    channel: NotificationChannel | NotificationChannel[];
    recipients: Recipient[];
    content: NotificationContent;
    priority: NotificationPriority;
    scheduledAt?: Date;
    metadata?: Record<string, any>;
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