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
    }
};

export default config;