import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import config from '../../config';
import { ApiError } from '../../middleware/error.middleware';

// Enhanced JWT Authentication with blacklisting
export class JWTManager {
    private redis: Redis;

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    async createToken(payload: any, expiresIn: string = '1h'): Promise<string> {
        return jwt.sign(payload, config.jwt.secret, { expiresIn });
    }

    async verifyToken(token: string): Promise<any> {
        // Check if token is blacklisted
        const isBlacklisted = await this.redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
            throw new ApiError(401, 'Token has been revoked');
        }

        return jwt.verify(token, config.jwt.secret);
    }

    async blacklistToken(token: string, expiresIn: number): Promise<void> {
        await this.redis.set(`blacklist:${token}`, '1', 'EX', expiresIn);
    }
}