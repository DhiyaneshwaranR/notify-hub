import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

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
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
    },

    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000, // default 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // default 100 requests per windowMs
    },

    // JWT (for future auth implementation)
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRE || '24h',
    },

    // Logger
    logger: {
        level: process.env.LOG_LEVEL || 'debug',
    },

    // Email
    email: {
        sendgridApiKey: process.env.SENDGRID_API_KEY || '',
        webhookSigningKey: process.env.SENDGRID_WEBHOOK_SIGNING_KEY || '',
        fromEmail: process.env.EMAIL_FROM || 'notifications@yourdomain.com',
        fromName: process.env.EMAIL_FROM_NAME || 'Notify Hub',
        maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000'),
        maxAttachmentSize: parseInt(process.env.EMAIL_MAX_ATTACHMENT_SIZE || String(10 * 1024 * 1024)) // 10MB default
    },

    retry: {
        maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '5'),
        initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY || '1000'),
    },
    queue: {
        priorities: {
            CRITICAL: {
                maxSize: 1000,
                maxErrorRate: 5, // 5%
                maxAttempts: 5,
                backoffDelay: 1000,
                ttl: 300,
                workerConcurrency: 5,
                rateLimit: {
                    windowSeconds: 1,
                    maxRequests: 100
                }
            },
            HIGH: {
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
            MEDIUM: {
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
            LOW: {
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
        },
        dlq: {
            maxSize: 10000,
            processingBatchSize: 100,
            retryAfter: 3600
        },
        maintenance: {
            interval: 60000, // Run maintenance every minute
            cleanupBatchSize: 1000
        },
        healthCheck: {
            interval: 30000, // Run health checks every 30 seconds
            circuitBreakerThreshold: 5,
            circuitBreakerRecoveryTime: 60000
        },
        maxProcessingItems: 1000,
        processingTimeout: 300, // 5 minutes
    }
};

export default config;