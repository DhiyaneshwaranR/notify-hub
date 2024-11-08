import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
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
};

export default config;