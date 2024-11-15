export enum SMSStatus {
    QUEUED = 'QUEUED',
    SENDING = 'SENDING',
    SENT = 'SENT',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED',
    UNDELIVERED = 'UNDELIVERED'
}

export interface SMSTrackingInfo {
    messageId: string;          // Twilio Message SID
    notificationId: string;     // Our internal notification ID
    status: SMSStatus;
    recipient: string;         // Phone number
    errorCode?: string;        // Twilio error code if any
    errorMessage?: string;     // Error message if failed
    provider: string;          // SMS provider (e.g., 'twilio')
    cost?: number;            // Message cost if available
    segments?: string;        // Number of SMS segments
    sentAt?: Date;
    deliveredAt?: Date;
    updatedAt: Date;
    metadata?: Record<string, any>;
}

export interface BulkSMSProgress {
    total: number;
    sent: number;
    failed: number;
    status: 'processing' | 'completed' | 'failed';
    startedAt: Date;
    completedAt?: Date;
    batchId: string;
}

export interface BulkSMSResult {
    batchId: string;
    successful: Array<{
        recipient: string;
        messageId: string;
    }>;
    failed: Array<{
        recipient: string;
        error: string;
    }>;
    progress: BulkSMSProgress;
}