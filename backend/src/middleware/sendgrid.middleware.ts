import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config';
import logger from '../utils/logger';

export const validateWebhookSignature = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        const signature = req.get('X-Twilio-Email-Event-Webhook-Signature') || '';
        const timestamp = req.get('X-Twilio-Email-Event-Webhook-Timestamp') || '';

        // Verify timestamp is within 5 minutes
        const timestampDate = new Date(Number(timestamp) * 1000);
        const now = new Date();
        const fiveMinutes = 5 * 60 * 1000;

        if (Math.abs(now.getTime() - timestampDate.getTime()) > fiveMinutes) {
            logger.warn('Webhook timestamp is outside of tolerance window', {
                timestamp,
                ip: req.ip
            });
            res.sendStatus(403);
            return;
        }

        // Verify signature
        const payload = `${timestamp}${JSON.stringify(req.body)}`;
        const hmac = crypto.createHmac('sha256', config.email.webhookSigningKey);
        const digest = hmac.update(payload).digest('base64');

        if (signature !== digest) {
            logger.warn('Invalid webhook signature received', {
                signature,
                timestamp,
                ip: req.ip
            });
            res.sendStatus(403);
            return;
        }

        next();
    } catch (error) {
        logger.error('Error validating webhook signature', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.sendStatus(500);
    }
};