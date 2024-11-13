import { Router } from 'express';
import { EmailService } from '../services/email.service';
import { validateWebhookSignature } from '../middleware/sendgrid.middleware';
import logger from '../utils/logger';
import {SMSService} from "@/services/sms.service";

const router = Router();
const emailService = new EmailService();
const smsService = new SMSService();

// SendGrid Webhook Events
router.post('/email/events',
    validateWebhookSignature,
    async (req, res) => {
        try {
            // SendGrid can send single event or array of events
            const events = Array.isArray(req.body) ? req.body : [req.body];

            logger.info('Received email webhook events', {
                count: events.length,
                types: events.map(e => e.event)
            });

            await Promise.all(
                events.map(async event => {
                    try {
                        await emailService.handleWebhookEvent(event);
                    } catch (error) {
                        logger.error('Error processing email event', {
                            eventType: event.event,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                        // Continue processing other events even if one fails
                    }
                })
            );

            res.sendStatus(200);
        } catch (error) {
            logger.error('Error handling email webhook', {
                error: error instanceof Error ? error.message : 'Unknown error',
                body: req.body
            });
            res.sendStatus(500);
        }
    }
);

// SMS Webhook Events
router.post('/sms/status/:notificationId',
    async (req, res) => {
        try {
            await smsService.handleWebhookEvent(req.body);
            res.sendStatus(200);
        } catch (error) {
            logger.error('Error handling SMS webhook', {
                error: error instanceof Error ? error.message : 'Unknown error',
                body: req.body
            });
            res.sendStatus(500);
        }
    }
);

export default router;