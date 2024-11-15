import dotenv from 'dotenv';
import path from 'path';
import { NotificationChannel, NotificationPriority } from '../types/notification';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Type definitions for queue priority config
interface QueuePriorityConfig {
    maxSize: number;
    maxErrorRate: number;
    maxAttempts: number;
    backoffDelay: number;
    ttl: number;
    workerConcurrency: number;
    rateLimit: {
        windowSeconds: number;
        maxRequests: number;
    };
}
//
// interface SMSRateLimit {
//     maxRequestsPerSecond: number;
//     maxRequestsPerMinute: number;
//     maxRequestsPerHour: number;
//     maxConcurrentRequests: number;
// }
//
// // Update SMS config interface
// interface SMSConfig {
//     twilioAccountSid: string;
//     twilioAuthToken: string;
//     fromNumber: string;
//     maxRetries: number;
//     retryDelay: number;
//     // Add rate limit configuration
//     rateLimit: SMSRateLimit;
//     // Add batch configuration
//     batch: {
//         size: number;
//         maxConcurrent: number;
//         retryAttempts: number;
//         retryDelay: number;
//     };
// }

// Type definitions for channel-specific config
type ChannelConfig = {
    [key in NotificationChannel]: {
        workerConcurrency: number;
        priorities: Record<NotificationPriority, QueuePriorityConfig>;
    };
};

const queuePriorityDefaults: Record<NotificationPriority, QueuePriorityConfig> = {
    [NotificationPriority.CRITICAL]: {
        maxSize: 1000,
        maxErrorRate: 5,
        maxAttempts: 5,
        backoffDelay: 1000,
        ttl: 300,
        workerConcurrency: 5,
        rateLimit: {
            windowSeconds: 1,
            maxRequests: 100
        }
    },
    [NotificationPriority.HIGH]: {
        maxSize: 5000,
        maxErrorRate: 10,
        maxAttempts: 4,
        backoffDelay: 5000,
        ttl: 3600,
        workerConcurrency: 3,
        rateLimit: {
            windowSeconds: 1,
            maxRequests: 50
        }
    },
    [NotificationPriority.MEDIUM]: {
        maxSize: 10000,
        maxErrorRate: 15,
        maxAttempts: 3,
        backoffDelay: 15000,
        ttl: 7200,
        workerConcurrency: 2,
        rateLimit: {
            windowSeconds: 1,
            maxRequests: 20
        }
    },
    [NotificationPriority.LOW]: {
        maxSize: 20000,
        maxErrorRate: 20,
        maxAttempts: 2,
        backoffDelay: 30000,
        ttl: 14400,
        workerConcurrency: 1,
        rateLimit: {
            windowSeconds: 1,
            maxRequests: 10
        }
    }
};

// Channel-specific configurations
const channelConfig: ChannelConfig = {
    [NotificationChannel.EMAIL]: {
        workerConcurrency: 5,
        priorities: queuePriorityDefaults
    },
    [NotificationChannel.SMS]: {
        workerConcurrency: 3,
        priorities: queuePriorityDefaults
    },
    [NotificationChannel.PUSH]: {
        workerConcurrency: 4,
        priorities: queuePriorityDefaults
    },
    [NotificationChannel.WEBHOOK]: {
        workerConcurrency: 2,
        priorities: queuePriorityDefaults
    }
};

const config = {
    app: {
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        name: process.env.APP_NAME || 'Notify Hub',
    },
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,

    // MongoDB
    mongoose: {
        url: process.env.MONGODB_URI || 'mongodb://localhost:27017/notify-hub',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        },
    },

    // Redis
    redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
    },

    // Email
    email: {
        sendgridApiKey: process.env.SENDGRID_API_KEY || '',
        webhookSigningKey: process.env.SENDGRID_WEBHOOK_SIGNING_KEY || '',
        fromEmail: process.env.EMAIL_FROM || 'notifications@yourdomain.com',
        fromName: process.env.EMAIL_FROM_NAME || 'Notify Hub',
        maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000'),
        maxAttachmentSize: parseInt(process.env.EMAIL_MAX_ATTACHMENT_SIZE || String(10 * 1024 * 1024))
    },

    // SMS
    sms: {
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
        fromNumber: process.env.SMS_FROM_NUMBER || '',
        maxRetries: parseInt(process.env.SMS_MAX_RETRIES || '5'),
        retryDelay: parseInt(process.env.SMS_RETRY_DELAY || '5000'),
        // Add rate limiting configuration
        rateLimit: {
            maxRequestsPerSecond: parseInt(process.env.SMS_MAX_REQUESTS_PER_SECOND || '100'),
            maxRequestsPerMinute: parseInt(process.env.SMS_MAX_REQUESTS_PER_MINUTE || '1800'),
            maxRequestsPerHour: parseInt(process.env.SMS_MAX_REQUESTS_PER_HOUR || '25000'),
            maxConcurrentRequests: parseInt(process.env.SMS_MAX_CONCURRENT_REQUESTS || '25')
        },
        // Add batch configuration
        batch: {
            size: parseInt(process.env.SMS_BATCH_SIZE || '100'),
            maxConcurrent: parseInt(process.env.SMS_MAX_CONCURRENT_BATCHES || '5'),
            retryAttempts: parseInt(process.env.SMS_BATCH_RETRY_ATTEMPTS || '3'),
            retryDelay: parseInt(process.env.SMS_BATCH_RETRY_DELAY || '5000')
        }
    },

    retry: {
        maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '5'),
        initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY || '1000'),
    },

    // Queue Configuration
    queue: {
        channels: channelConfig,
        priorities: queuePriorityDefaults, // Add this line to make priorities accessible
        dlq: {
            maxSize: 10000,
            processingBatchSize: 100,
            retryAfter: 3600
        },
        maintenance: {
            interval: 60000,
            cleanupBatchSize: 1000
        },
        healthCheck: {
            interval: 30000,
            circuitBreakerThreshold: 5,
            circuitBreakerRecoveryTime: 60000
        },
        maxProcessingItems: 1000,
        processingTimeout: 300
    },

    // Add logger configuration
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        file: {
            error: 'logs/error.log',
            combined: 'logs/combined.log'
        }
    }
};

export default config;