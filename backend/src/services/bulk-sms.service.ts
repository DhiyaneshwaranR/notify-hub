import { v4 as uuidv4 } from 'uuid';
import { SMSService } from './sms.service';
import { NotificationRequest } from '../types/notification';
import Redis from 'ioredis';
import { queueMetrics } from '../monitoring/metrics';
import logger from '../utils/logger';
import config from '../config';
import {BulkSMSProgress} from "@/types/sms";

export class BulkSMSService {

    private readonly BATCH_SIZE: number;
    private readonly MAX_CONCURRENT_BATCHES: number;
    private readonly RATE_LIMIT_WINDOW = 1000; // 1 second window
    private readonly rateLimiterKey = 'sms:ratelimit';

    private redis: Redis;
    private smsService: SMSService;
    constructor() {
        this.redis = new Redis(config.redis);
        this.smsService = new SMSService();
        this.BATCH_SIZE = config.sms.batch.size;
        this.MAX_CONCURRENT_BATCHES = config.sms.batch.maxConcurrent;
    }

    async sendBulkSMS(notification: NotificationRequest): Promise<string> {
        const batchId = uuidv4();
        const recipients = notification.recipients;
        const totalMessages = recipients.length;

        // Initialize progress tracking
        const progress: BulkSMSProgress = {
            total: totalMessages,
            sent: 0,
            failed: 0,
            status: 'processing',
            startedAt: new Date(),
            batchId
        };

        // Store initial progress
        await this.updateProgress(batchId, progress);

        // Start processing in background
        this.processBulkSMS(batchId, notification).catch(error => {
            logger.error('Bulk SMS processing failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                batchId
            });
        });

        return batchId;
    }

    private async processBulkSMS(batchId: string, notification: NotificationRequest): Promise<void> {
        const recipients = notification.recipients;
        const batches = this.createBatches(recipients, this.BATCH_SIZE);

        try {
            let currentBatch = 0;
            const processingPromises: Promise<void>[] = [];

            for (const batch of batches) {
                currentBatch++;

                // Ensure we don't exceed max concurrent batches
                if (processingPromises.length >= this.MAX_CONCURRENT_BATCHES) {
                    await Promise.race(processingPromises);
                }

                const batchPromise = this.processBatch(
                    batchId,
                    notification,
                    batch,
                    currentBatch,
                    batches.length
                );

                processingPromises.push(batchPromise);

                // Wait for rate limit window
                await this.waitForRateLimit();
            }

            // Wait for all remaining batches to complete
            await Promise.all(processingPromises);

            const progress = await this.getProgress(batchId);
            progress.status = 'completed';
            progress.completedAt = new Date();
            await this.updateProgress(batchId, progress);

            // Update metrics
            queueMetrics.messageStatus.inc({
                channel: 'sms',
                status: 'bulk_completed'
            });

        } catch (error) {
            const progress = await this.getProgress(batchId);
            if (progress) {
                progress.status = 'failed';
                progress.completedAt = new Date();
                await this.updateProgress(batchId, progress);

                logger.error('Bulk SMS processing failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    batchId,
                    totalSent: progress.sent,
                    totalFailed: progress.failed
                });
            }
            throw error;
        }
    }

    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    private async updateProgress(batchId: string, progress: BulkSMSProgress): Promise<void> {
        await this.redis.set(
            `sms:bulk:${batchId}`,
            JSON.stringify(progress),
            'EX',
            86400 // 24 hours expiry
        );
    }

    private async getProgress(batchId: string): Promise<BulkSMSProgress> {
        const progress = await this.redis.get(`sms:bulk:${batchId}`);
        return progress ? JSON.parse(progress) : null;
    }

    async getBulkStatus(batchId: string): Promise<BulkSMSProgress | null> {
        return this.getProgress(batchId);
    }

    private async processBatch(
        batchId: string,
        notification: NotificationRequest,
        recipientBatch: typeof notification.recipients,
        batchNumber: number,
        totalBatches: number
    ): Promise<void> {
        let retryAttempt = 0;

        while (retryAttempt < config.sms.batch.retryAttempts) {
            try {
                const batchNotification = {
                    ...notification,
                    recipients: recipientBatch
                };

                const startTime = Date.now();

                // Check concurrent requests limit
                const processingKey = `${this.rateLimiterKey}:processing`;
                const processing = await this.redis.incr(processingKey);

                if (processing > config.sms.rateLimit.maxConcurrentRequests) {
                    await this.redis.decr(processingKey);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                try {
                    await this.smsService.sendSMS(batchNotification);
                } finally {
                    await this.redis.decr(processingKey);
                }

                // Update progress and metrics
                const progress = await this.getProgress(batchId);
                progress.sent += recipientBatch.length;
                await this.updateProgress(batchId, progress);

                const duration = Date.now() - startTime;

                queueMetrics.messageDeliveryTime.observe({
                    channel: 'sms',
                    status: 'batch_processed'
                }, duration / 1000);

                logger.info('Batch processed successfully', {
                    batchId,
                    batchNumber,
                    totalBatches,
                    recipients: recipientBatch.length,
                    duration,
                    retryAttempt
                });

                return;

            } catch (error) {
                retryAttempt++;

                if (retryAttempt >= config.sms.batch.retryAttempts) {
                    // Update failed count
                    const progress = await this.getProgress(batchId);
                    progress.failed += recipientBatch.length;
                    await this.updateProgress(batchId, progress);

                    logger.error('Batch processing failed permanently', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        batchId,
                        batchNumber,
                        recipients: recipientBatch.length,
                        retryAttempt
                    });

                    throw error;
                }

                logger.warn('Batch processing failed, retrying', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    batchId,
                    batchNumber,
                    retryAttempt,
                    nextRetryIn: config.sms.batch.retryDelay
                });

                await new Promise(resolve =>
                    setTimeout(resolve, config.sms.batch.retryDelay)
                );
            }
        }
    }

    private async waitForRateLimit(): Promise<void> {
        const now = Date.now();
        const secondKey = `${this.rateLimiterKey}:second:${Math.floor(now / 1000)}`;
        const minuteKey = `${this.rateLimiterKey}:minute:${Math.floor(now / 60000)}`;
        const hourKey = `${this.rateLimiterKey}:hour:${Math.floor(now / 3600000)}`;

        const pipeline = this.redis.pipeline();

        // Increment and set expiry for each window
        pipeline.incr(secondKey).expire(secondKey, 2);
        pipeline.incr(minuteKey).expire(minuteKey, 120);
        pipeline.incr(hourKey).expire(hourKey, 7200);

        const results = await pipeline.exec();

        if (!results) {
            throw new Error('Failed to check rate limits');
        }

        const [secondCount, minuteCount, hourCount] = results.map(r => r?.[1] as number);

        // Update current usage metrics
        queueMetrics.rateLimits.set({
            channel: 'sms',
            window: 'second',
            type: 'current'
        }, secondCount);

        queueMetrics.rateLimits.set({
            channel: 'sms',
            window: 'minute',
            type: 'current'
        }, minuteCount);

        queueMetrics.rateLimits.set({
            channel: 'sms',
            window: 'hour',
            type: 'current'
        }, hourCount);

        // Also set limit values for reference
        queueMetrics.rateLimits.set({
            channel: 'sms',
            window: 'second',
            type: 'limit'
        }, config.sms.rateLimit.maxRequestsPerSecond);

        queueMetrics.rateLimits.set({
            channel: 'sms',
            window: 'minute',
            type: 'limit'
        }, config.sms.rateLimit.maxRequestsPerMinute);

        queueMetrics.rateLimits.set({
            channel: 'sms',
            window: 'hour',
            type: 'limit'
        }, config.sms.rateLimit.maxRequestsPerHour);

        // Check if we've hit any rate limits
        let rateLimitHit = false;
        let waitTime = 0;

        if (secondCount > config.sms.rateLimit.maxRequestsPerSecond) {
            rateLimitHit = true;
            waitTime = this.RATE_LIMIT_WINDOW;
            queueMetrics.rateLimitRejections.inc({
                channel: 'sms',
                window: 'second'
            });
        } else if (minuteCount > config.sms.rateLimit.maxRequestsPerMinute) {
            rateLimitHit = true;
            waitTime = 60000; // 1 minute
            queueMetrics.rateLimitRejections.inc({
                channel: 'sms',
                window: 'minute'
            });
        } else if (hourCount > config.sms.rateLimit.maxRequestsPerHour) {
            rateLimitHit = true;
            waitTime = 300000; // 5 minutes
            queueMetrics.rateLimitRejections.inc({
                channel: 'sms',
                window: 'hour'
            });
        }

        if (rateLimitHit) {
            logger.warn('Rate limit reached, waiting before next batch', {
                secondCount,
                minuteCount,
                hourCount,
                waitTime
            });

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Update concurrent requests metric
        const processingKey = `${this.rateLimiterKey}:processing`;
        const concurrentRequests = await this.redis.get(processingKey);

        queueMetrics.concurrentRequests.set({
            channel: 'sms'
        }, parseInt(concurrentRequests || '0'));
    }
}