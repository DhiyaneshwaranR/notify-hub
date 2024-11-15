import { SMSTrackingInfo, SMSStatus } from '../types/sms';
import SMSTrackingModel from '../models/sms-tracking.model';
import logger from '../utils/logger';
import { queueMetrics } from '../monitoring/metrics';

export class SMSTrackingService {
    async createTracking(trackingInfo: Omit<SMSTrackingInfo, 'updatedAt'>): Promise<SMSTrackingInfo> {
        try {
            const tracking = await SMSTrackingModel.create({
                ...trackingInfo,
                updatedAt: new Date()
            });

            // Update status metric
            queueMetrics.messageStatus.inc({
                channel: 'sms',
                status: trackingInfo.status.toLowerCase()
            });

            logger.info('SMS tracking created', {
                messageId: trackingInfo.messageId,
                status: trackingInfo.status
            });

            return tracking.toObject();
        } catch (error) {
            logger.error('Failed to create SMS tracking', {
                error: error instanceof Error ? error.message : 'Unknown error',
                messageId: trackingInfo.messageId
            });
            throw error;
        }
    }

    async updateStatus(
        messageId: string,
        status: SMSStatus,
        updates: Partial<SMSTrackingInfo> = {}
    ): Promise<SMSTrackingInfo | null> {
        try {
            const previousTracking = await SMSTrackingModel.findOne({ messageId });
            const tracking = await SMSTrackingModel.findOneAndUpdate(
                { messageId },
                {
                    $set: {
                        status,
                        updatedAt: new Date(),
                        ...updates
                    }
                },
                { new: true }
            );

            if (!tracking) {
                logger.warn('SMS tracking not found for update', { messageId });
                return null;
            }

            // Update status metric
            queueMetrics.messageStatus.inc({
                channel: 'sms',
                status: status.toLowerCase()
            });

            // If message is delivered, calculate delivery time
            if (status === SMSStatus.DELIVERED && tracking.sentAt) {
                const deliveryTime = (new Date().getTime() - tracking.sentAt.getTime()) / 1000;
                queueMetrics.messageDeliveryTime.observe({
                    channel: 'sms',
                    status: 'delivered'
                }, deliveryTime);
            }

            // Update failure rate if status is failed
            if (status === SMSStatus.FAILED || status === SMSStatus.UNDELIVERED) {
                await this.updateFailureRate();
            }

            logger.info('SMS tracking updated', {
                messageId,
                status,
                recipient: tracking.recipient,
                previousStatus: previousTracking?.status
            });

            return tracking.toObject();
        } catch (error) {
            logger.error('Failed to update SMS tracking', {
                error: error instanceof Error ? error.message : 'Unknown error',
                messageId
            });
            throw error;
        }
    }

    private async updateFailureRate(): Promise<void> {
        try {
            // Calculate failure rate over the last hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            const [failureStats] = await SMSTrackingModel.aggregate([
                {
                    $match: {
                        updatedAt: { $gte: oneHourAgo },
                        status: { $in: [SMSStatus.FAILED, SMSStatus.UNDELIVERED] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        failures: {
                            $sum: {
                                $cond: [
                                    { $in: ['$status', [SMSStatus.FAILED, SMSStatus.UNDELIVERED]] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            if (failureStats) {
                const failureRate = (failureStats.failures / failureStats.total) * 100;
                queueMetrics.messageFailureRate.set({
                    channel: 'sms'
                }, failureRate);
            }
        } catch (error) {
            logger.error('Failed to update failure rate', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async getTrackingInfo(messageId: string): Promise<SMSTrackingInfo | null> {
        try {
            const tracking = await SMSTrackingModel.findOne({ messageId });
            return tracking?.toObject() || null;
        } catch (error) {
            logger.error('Failed to get SMS tracking', {
                error: error instanceof Error ? error.message : 'Unknown error',
                messageId
            });
            throw error;
        }
    }

    async getNotificationTracking(notificationId: string): Promise<SMSTrackingInfo[]> {
        try {
            const trackingInfos = await SMSTrackingModel.find({ notificationId });
            return trackingInfos.map(tracking => tracking.toObject());
        } catch (error) {
            logger.error('Failed to get notification tracking', {
                error: error instanceof Error ? error.message : 'Unknown error',
                notificationId
            });
            throw error;
        }
    }

    async getDeliveryStats(notificationId: string): Promise<Record<SMSStatus, number>> {
        try {
            const stats = await SMSTrackingModel.aggregate([
                { $match: { notificationId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            return stats.reduce((acc, { _id, count }) => {
                acc[_id as SMSStatus] = count;
                return acc;
            }, {} as Record<SMSStatus, number>);
        } catch (error) {
            logger.error('Failed to get delivery stats', {
                error: error instanceof Error ? error.message : 'Unknown error',
                notificationId
            });
            throw error;
        }
    }
}