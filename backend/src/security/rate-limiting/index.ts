import { Router } from 'express';
import { RateLimiter } from './rate-limiter';
import redis from '../../config/redis';

export function setupRateLimiting(router: Router): void {

    // Global API rate limit
    router.use(RateLimiter.createApiLimiter(redis));

    // Auth endpoints
    router.use('/auth/login', RateLimiter.createAuthLimiter(redis));
    router.use('/auth/register', RateLimiter.createAuthLimiter(redis));

    // High-throughput endpoints with burst capacity
    router.use('/notifications/bulk', RateLimiter.createBurstLimiter(redis));

    // Custom rate limits for specific endpoints
    router.use('/api/v1/webhooks', RateLimiter.createBurstLimiter(redis));
}