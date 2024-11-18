import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { ApiError } from '../../middleware/error.middleware';
import logger from '../../utils/logger';
import { UserRole } from '../access-control/rbac';
import { queueMetrics } from '../../monitoring/metrics';

export enum RateLimitType {
    SLIDING_WINDOW = 'sliding_window',
    FIXED_WINDOW = 'fixed_window',
    TOKEN_BUCKET = 'token_bucket'
}

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    type?: RateLimitType;
    keyPrefix?: string;
    errorMessage?: string;
    skipFailedRequests?: boolean;
    requestCost?: number;
    burstLimit?: number;
}

export interface RateLimitInfo {
    limit: number;
    current: number;
    remaining: number;
    resetTime: number;
}

export class RateLimiter {
    private redis: Redis;

    constructor(redisClient: Redis) {
        this.redis = redisClient;
        this.startCleanup();
    }

    private startCleanup(): void {
        // Cleanup expired keys every hour
        setInterval(() => {
            this.cleanupExpiredKeys().catch(error => {
                logger.error('Rate limiter cleanup failed', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });
        }, 60 * 60 * 1000);
    }

    private async cleanupExpiredKeys(): Promise<void> {
        const script = `
            local keys = redis.call('keys', ARGV[1])
            local deleted = 0
            for i, key in ipairs(keys) do
                local ttl = redis.call('ttl', key)
                if ttl <= 0 then
                    redis.call('del', key)
                    deleted = deleted + 1
                end
            end
            return deleted
        `;

        const deletedCount = await this.redis.eval(
            script,
            0,
            'ratelimit:*'
        );

        logger.info('Rate limiter cleanup completed', { deletedKeys: deletedCount });
    }

    middleware(config: RateLimitConfig) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                // Skip rate limiting for admins
                if (req.user?.role === UserRole.ADMIN) {
                    return next();
                }

                const key = this.generateKey(req, config.keyPrefix);
                const info = await this.checkRateLimit(key, config);

                // Set rate limit headers
                this.setRateLimitHeaders(res, info);

                // Update metrics
                this.updateMetrics(req.path, info);

                if (info.remaining < 0) {
                    // Log rate limit hit
                    logger.warn('Rate limit exceeded', {
                        path: req.path,
                        ip: req.ip,
                        userId: req.user?.id,
                        limit: info.limit,
                        current: info.current
                    });

                    throw new ApiError(429, config.errorMessage || 'Too many requests');
                }

                next();
            } catch (error) {
                if (error instanceof ApiError) {
                    next(error);
                } else {
                    next(new ApiError(500, 'Rate limiting error'));
                }
            }
        };
    }

    private generateKey(req: Request, keyPrefix = ''): string {
        const baseKey = req.user?.id || req.ip;
        return `ratelimit:${keyPrefix}:${baseKey}:${req.path}`;
    }

    private async checkRateLimit(
        key: string,
        config: RateLimitConfig
    ): Promise<RateLimitInfo> {
        switch (config.type || RateLimitType.SLIDING_WINDOW) {
            case RateLimitType.SLIDING_WINDOW:
                return this.slidingWindowRateLimit(key, config);
            case RateLimitType.FIXED_WINDOW:
                return this.fixedWindowRateLimit(key, config);
            case RateLimitType.TOKEN_BUCKET:
                return this.tokenBucketRateLimit(key, config);
            default:
                throw new Error('Invalid rate limit type');
        }
    }

    private async slidingWindowRateLimit(
        key: string,
        config: RateLimitConfig
    ): Promise<RateLimitInfo> {
        const now = Date.now();
        const windowStart = now - config.windowMs;

        // Remove old requests and add new one
        const multi = this.redis.multi();
        multi.zremrangebyscore(key, 0, windowStart);
        multi.zadd(key, now, `${now}`);
        multi.zcard(key);
        multi.pexpire(key, config.windowMs);

        const results = await multi.exec();
        const count = results ? Number(results[2]?.[1]) || 0 : 0;

        return {
            limit: config.maxRequests,
            current: count,
            remaining: Math.max(0, config.maxRequests - count),
            resetTime: now + config.windowMs
        };
    }

    private async fixedWindowRateLimit(
        key: string,
        config: RateLimitConfig
    ): Promise<RateLimitInfo> {
        const now = Date.now();
        const windowKey = `${key}:${Math.floor(now / config.windowMs)}`;

        const multi = this.redis.multi();
        multi.incr(windowKey);
        multi.pexpire(windowKey, config.windowMs);

        const results = await multi.exec();
        const count = results ? Number(results[0]?.[1]) || 0 : 0;

        return {
            limit: config.maxRequests,
            current: count,
            remaining: Math.max(0, config.maxRequests - count),
            resetTime: Math.ceil(now / config.windowMs) * config.windowMs
        };
    }

    private async tokenBucketRateLimit(
        key: string,
        config: RateLimitConfig
    ): Promise<RateLimitInfo> {
        const now = Date.now();
        const requestCost = config.requestCost || 1;
        const burstLimit = config.burstLimit || config.maxRequests;

        const script = `
            local tokens = tonumber(redis.call('get', KEYS[1]) or ARGV[1])
            local lastUpdate = tonumber(redis.call('get', KEYS[2]) or ARGV[2])
            local timePassed = ARGV[2] - lastUpdate
            local rate = ARGV[3]
            local newTokens = math.min(ARGV[1], tokens + (timePassed * rate))
            
            if newTokens >= ARGV[4] then
                newTokens = newTokens - ARGV[4]
                redis.call('set', KEYS[1], newTokens)
                redis.call('set', KEYS[2], ARGV[2])
                redis.call('pexpire', KEYS[1], ARGV[5])
                redis.call('pexpire', KEYS[2], ARGV[5])
                return {newTokens, 1}
            end
            
            return {newTokens, 0}
        `;

        const result = await this.redis.eval(
            script,
            2,
            `${key}:tokens`,
            `${key}:timestamp`,
            burstLimit.toString(),
            now.toString(),
            (config.maxRequests / config.windowMs).toString(),
            requestCost.toString(),
            config.windowMs.toString()
        );

        const [tokens] = result as [number];

        return {
            limit: config.maxRequests,
            current: config.maxRequests - tokens,
            remaining: tokens,
            resetTime: now + Math.ceil((burstLimit - tokens) / (config.maxRequests / config.windowMs))
        };
    }

    private setRateLimitHeaders(res: Response, info: RateLimitInfo): void {
        res.setHeader('X-RateLimit-Limit', info.limit);
        res.setHeader('X-RateLimit-Remaining', info.remaining);
        res.setHeader('X-RateLimit-Reset', info.resetTime);
    }

    private updateMetrics(path: string, info: RateLimitInfo): void {
        queueMetrics.rateLimits.set({
            channel: path,
            type: 'current'
        }, info.current);

        queueMetrics.rateLimits.set({
            channel: path,
            type: 'remaining'
        }, info.remaining);

        if (info.remaining < 0) {
            queueMetrics.rateLimitRejections.inc({
                channel: path,
                window: 'minute'
            });
        }
    }

    // Factory methods for common configurations
    static createApiLimiter(redis: Redis) {
        const limiter = new RateLimiter(redis);
        return limiter.middleware({
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 60,
            type: RateLimitType.SLIDING_WINDOW,
            keyPrefix: 'api',
            errorMessage: 'Too many API requests. Please try again later.',
            skipFailedRequests: true
        });
    }

    static createAuthLimiter(redis: Redis) {
        const limiter = new RateLimiter(redis);
        return limiter.middleware({
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 5,
            type: RateLimitType.FIXED_WINDOW,
            keyPrefix: 'auth',
            errorMessage: 'Too many login attempts. Please try again later.',
            skipFailedRequests: false
        });
    }

    static createBurstLimiter(redis: Redis) {
        const limiter = new RateLimiter(redis);
        return limiter.middleware({
            windowMs: 1000, // 1 second
            maxRequests: 10,
            type: RateLimitType.TOKEN_BUCKET,
            keyPrefix: 'burst',
            burstLimit: 20,
            requestCost: 1,
            errorMessage: 'Request rate too high. Please slow down.'
        });
    }
}