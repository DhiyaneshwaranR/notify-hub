import { Twilio } from 'twilio';
import { NotificationRequest } from '../types/notification';
import { SMSTemplateService } from './sms.template.service';
import { ValidationError } from '../types/errors';
import { notificationCounter } from '../monitoring/metrics';
import config from '../config';
import logger from '../utils/logger';
import { TemplateName, SMSTemplateData } from '../templates/template-registry';

export class SMSService {
    private client: Twilio;
    private templateService: SMSTemplateService;
    private readonly phoneRegex = /^\+[1-9]\d{1,14}$/;

    constructor() {
        if (!config.sms.twilioAccountSid || !config.sms.twilioAuthToken) {
            throw new Error('Twilio credentials are required');
        }

        this.client = new Twilio(
            config.sms.twilioAccountSid,
            config.sms.twilioAuthToken
        );
        this.templateService = new SMSTemplateService();
    }

    private validatePhoneNumber(phone: string): boolean {
        return this.phoneRegex.test(phone);
    }

    async sendSMS(notification: NotificationRequest, retryCount = 0): Promise<boolean> {
        try {
            // Validate phone numbers first
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
                const templateId = notification.content.templateId as TemplateName;
                const templateData = notification.content.templateData as SMSTemplateData[typeof templateId];

                messageBody = this.templateService.renderTemplate(
                    templateId,
                    {
                        ...templateData,
                        message: notification.content.body
                    }
                );
            }

            // Send to all recipients
            const sendPromises = notification.recipients.map(async recipient => {
                const message = await this.client.messages.create({
                    to: recipient.destination,
                    from: config.sms.fromNumber,
                    body: messageBody,
                    statusCallback: this.getStatusCallbackUrl(recipient.id!),
                    ...(process.env.NODE_ENV === 'test' && { providerId: 'test_message_id' })
                });

                logger.info('SMS sent successfully', {
                    messageId: message.sid,
                    recipient: recipient.destination
                });

                return message;
            });

            await Promise.all(sendPromises);
            notificationCounter.inc({ channel: 'sms', status: 'success' });
            return true;

        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }

            // Handle retries for other errors
            if (retryCount < config.sms.maxRetries) {
                logger.warn('Retrying SMS send', {
                    attempt: retryCount + 1,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                await new Promise(resolve => setTimeout(resolve, config.sms.retryDelay));
                return this.sendSMS(notification, retryCount + 1);
            }

            notificationCounter.inc({ channel: 'sms', status: 'failure' });
            logger.error('Failed to send SMS after retries', {
                attempts: retryCount + 1,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
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
                case 'queued':
                    notificationCounter.inc({ channel: 'sms', status: 'queued' });
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

    private getStatusCallbackUrl(notificationId: string): string {
        return `${config.app.baseUrl}/api/v1/webhooks/sms/status/${notificationId}`;
    }
}