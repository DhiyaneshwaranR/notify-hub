import logger from "../../utils/logger";
import Redis from "ioredis";

export interface AuditLog {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details: any;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
}

export class AuditLogger {
    private redis: Redis;

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    async log(log: AuditLog): Promise<void> {
        // Store in Redis for immediate access and processing
        await this.redis.lpush('audit:logs', JSON.stringify(log));

        // Also log to application logger for persistence
        logger.info('Audit log entry', {
            userId: log.userId,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            ipAddress: log.ipAddress,
            timestamp: log.timestamp
        });
    }

    async getLogs(filters: Partial<AuditLog>, limit: number = 100): Promise<AuditLog[]> {
        const logs = await this.redis.lrange('audit:logs', 0, limit - 1);
        return logs
            .map(log => JSON.parse(log))
            .filter(log => {
                return Object.entries(filters).every(([key, value]) =>
                    log[key] === value
                );
            });
    }
}