import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';

const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.info(`Retrying Redis connection... Attempt ${times}`);
        return delay;
    },
    maxRetriesPerRequest: null
});

redis.on('error', (error) => {
    logger.error('Redis connection error:', {
        error: error.message,
        host: config.redis.host,
        port: config.redis.port
    });
});

redis.on('connect', () => {
    logger.info('Redis connected successfully', {
        host: config.redis.host,
        port: config.redis.port
    });
});

redis.on('ready', () => {
    logger.info('Redis client ready');
});

redis.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
});

process.on('SIGTERM', () => {
    logger.info('Closing Redis connection');
    redis.disconnect();
});

export default redis;