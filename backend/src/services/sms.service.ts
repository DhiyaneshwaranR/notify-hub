import { Twilio } from 'twilio';
import { NotificationRequest } from '../types/notification';
import { TemplateService } from './template.service';
import { ValidationError } from '../types/errors';
import { notificationCounter, notificationDuration } from '../monitoring/metrics';
import config from '../config';
import logger from '../utils/logger';

export class SMSService {
    private client: Twilio;
    private templateService: TemplateService;
    private readonly maxRetries: number;
    private readonly retryDelay: number;

    constructor() {
        if (!config.sms.twilioAccountSid || !config.sms.twilioAuthToken) {
            throw new Error('Twilio credentials are required');
        }

        this.client = new Twilio(
            config.sms.twilioAccountSid,
            config.sms.twilioAuthToken
        );
        this.templateService = new TemplateService();
        this.maxRetries = config.sms.maxRetries;
        this.retryDelay = config.sms.retryDelay;
    }

    async sendSMS(notification: NotificationRequest, retryCount = 0): Promise<boolean> {
        const timer = notificationDuration.startTimer({ channel: 'sms' });

        try {
            // Validate phone numbers
            const invalidPhoneNumbers = notification.recipients
                .map(r => r.destination)
                .filter(phone => !this.validatePhoneNumber(phone));

            if (invalidPhoneNumbers.length > 0) {
                throw new ValidationError(
                    `Invalid phone numbers: ${invalidPhoneNumbers.join(', ')}`
                );
            }

            // Process template if specified
            let messageBody = notification.content.body;
            if (notification.content.templateId) {
                messageBody = await this.templateService.renderTemplate(
                    notification.content.templateId,
                    {
                        message: notification.content.body,
                        ...notification.content.templateData
                    }
                );
            }

            // Send SMS to each recipient
            const sendPromises = notification.recipients.map(async recipient => {
                const messageOptions = {
                    to: recipient.destination,
                    from: config.sms.fromNumber,
                    body: messageBody,
                    statusCallback: this.getStatusCallbackUrl(notification.id!),
                    ...(process.env.NODE_ENV === 'test' && { providerId: 'test_message_id' })
                };

                const message = await this.client.messages.create(messageOptions);

                logger.info('SMS sent successfully', {
                    notificationId: notification.id,
                    messageId: message.sid,
                    recipient: recipient.destination
                });

                return message;
            });

            await Promise.all(sendPromises);
            notificationCounter.inc({ channel: 'sms', status: 'success' });
            return true;

        } catch (error) {
            // Handle retries
            if (retryCount < this.maxRetries) {
                logger.warn('Retrying SMS send', {
                    notificationId: notification.id,
                    attempt: retryCount + 1,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.sendSMS(notification, retryCount + 1);
            }

            notificationCounter.inc({ channel: 'sms', status: 'failure' });
            logger.error('Failed to send SMS after retries', {
                notificationId: notification.id,
                attempts: retryCount + 1,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        } finally {
            timer();
        }
    }

    async handleWebhookEvent(event: any): Promise<void> {
        if (!event || !event.MessageSid) {
            logger.warn('Invalid webhook event received', { event });
            return;
        }

        const { MessageSid, MessageStatus, ErrorCode } = event;

        try {
            logger.info('SMS status update received', {
                messageId: MessageSid,
                status: MessageStatus,
                errorCode: ErrorCode
            });

            switch (MessageStatus) {
                case 'delivered':
                    notificationCounter.inc({ channel: 'sms', status: 'delivered' });
                    break;
                case 'failed':
                case 'undelivered':
                    notificationCounter.inc({ channel: 'sms', status: 'failed' });
                    break;
                default:
                    logger.info('Unhandled SMS status', {
                        messageId: MessageSid,
                        status: MessageStatus
                    });
            }
        } catch (error) {
            logger.error('Error processing SMS webhook event', {
                error: error instanceof Error ? error.message : 'Unknown error',
                messageId: MessageSid
            });
        }
    }

    private validatePhoneNumber(phone: string): boolean {
        // Basic E.164 format validation
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(phone);
    }

    private getStatusCallbackUrl(notificationId: string): string {
        return `${config.app.baseUrl}/api/v1/webhooks/sms/status/${notificationId}`;
    }
}