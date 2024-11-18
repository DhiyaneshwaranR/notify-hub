import { Redis } from 'ioredis';
import crypto from 'crypto';
import logger from '../../utils/logger';

export class APIKeyValidator {
    private redis: Redis;
    private readonly PREFIX = 'apikey:';

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    async validateKey(apiKey: string): Promise<boolean> {
        try {
            const keyInfo = await this.redis.get(`${this.PREFIX}${apiKey}`);
            if (!keyInfo) return false;

            // Update last used timestamp
            await this.redis.hset(`${this.PREFIX}${apiKey}`, 'lastUsed', Date.now());
            return true;
        } catch (error) {
            logger.error('API key validation error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    async createKey(userId: string, permissions: string[]): Promise<string> {
        try {
            const apiKey = this.generateAPIKey();
            await this.redis.hmset(`${this.PREFIX}${apiKey}`, {
                userId,
                permissions: JSON.stringify(permissions),
                createdAt: Date.now(),
                lastUsed: Date.now()
            });

            // Set expiry for API key (optional)
            // await this.redis.expire(`${this.PREFIX}${apiKey}`, 30 * 24 * 60 * 60); // 30 days

            logger.info('API key created', { userId });
            return apiKey;
        } catch (error) {
            logger.error('API key creation error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId
            });
            throw error;
        }
    }

    async getKeyInfo(apiKey: string): Promise<any | null> {
        try {
            const keyInfo = await this.redis.hgetall(`${this.PREFIX}${apiKey}`);
            if (!Object.keys(keyInfo).length) return null;

            return {
                ...keyInfo,
                permissions: JSON.parse(keyInfo.permissions)
            };
        } catch (error) {
            logger.error('API key info retrieval error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }

    async revokeKey(apiKey: string): Promise<boolean> {
        try {
            const result = await this.redis.del(`${this.PREFIX}${apiKey}`);
            return result === 1;
        } catch (error) {
            logger.error('API key revocation error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    private generateAPIKey(): string {
        const bytes = crypto.randomBytes(32);
        const timestamp = Date.now().toString(36);
        const randomPart = bytes.toString('hex');
        return `nh_${timestamp}_${randomPart}`;
    }
}