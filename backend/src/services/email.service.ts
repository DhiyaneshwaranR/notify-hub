import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { validate as validateEmail } from 'email-validator';
import config from '../config';
import logger from '../utils/logger';
import { NotificationRequest } from '../types/notification';
import { TemplateService } from './template.service';
import { notificationCounter, notificationDuration } from '../monitoring/metrics';
import { ValidationError } from '../types/errors';

export class EmailService {
    private templateService: TemplateService;
    private readonly maxAttachmentSize: number;
    private readonly maxRetries: number;
    private readonly retryDelay: number;

    constructor() {
        if (!config.email.sendgridApiKey) {
            throw new Error('SendGrid API key is required');
        }

        this.maxAttachmentSize = config.email.maxAttachmentSize;
        this.maxRetries = config.email.maxRetries;
        this.retryDelay = config.email.retryDelay;

        sgMail.setApiKey(config.email.sendgridApiKey);
        this.templateService = new TemplateService();
        this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.templateService.loadTemplates();
    }

    async sendEmail(notification: NotificationRequest, retryCount = 0): Promise<boolean> {
        const timer = notificationDuration.startTimer({ channel: 'email' });

        try {
            // Validate email addresses
            const invalidEmails = notification.recipients
                .map(r => r.destination)
                .filter(email => !this.validateEmailAddress(email));

            if (invalidEmails.length > 0) {
                throw new ValidationError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
            }

            // Process attachments if any
            const attachments = await this.processAttachments(notification.content.attachments);

            // Prepare template data
            const templateData = {
                title: notification.content.subject,
                message: notification.content.body,
                actionButton: notification.content.actionButton,
                unsubscribeLink: this.generateUnsubscribeLink(notification.recipients[0].id)
            };

            // Render email content
            const htmlContent = await this.templateService.renderTemplate(
                'notification',
                templateData
            );

            // Prepare email data
            const msg: MailDataRequired = {
                to: notification.recipients.map(r => ({
                    email: r.destination,
                    name: r.metadata?.name
                })),
                from: {
                    email: config.email.fromEmail,
                    name: config.email.fromName
                },
                subject: notification.content.subject,
                text: notification.content.body, // Plain text version
                html: htmlContent,
                attachments,
                trackingSettings: {
                    clickTracking: { enable: true },
                    openTracking: { enable: true }
                },
                customArgs: {
                    notificationId: notification.id
                }
            };

            // Send email
            const [response] = await sgMail.send(msg);

            if (response.statusCode >= 200 && response.statusCode < 300) {
                notificationCounter.inc({ channel: 'email', status: 'success' });
                logger.info('Email sent successfully', {
                    notificationId: notification.id,
                    messageId: response.headers['x-message-id']
                });
                return true;
            } else {
                throw new Error(`SendGrid responded with status code: ${response.statusCode}`);
            }

        } catch (error) {
            // Handle retries
            if (retryCount < this.maxRetries) {
                logger.warn('Retrying email send', {
                    notificationId: notification.id,
                    attempt: retryCount + 1,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.sendEmail(notification, retryCount + 1);
            }

            notificationCounter.inc({ channel: 'email', status: 'failure' });
            logger.error('Failed to send email after retries', {
                notificationId: notification.id,
                attempts: retryCount + 1,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        } finally {
            timer();
        }
    }

    private validateEmailAddress(email: string): boolean {
        return validateEmail(email);
    }

    private generateUnsubscribeLink(recipientId: string): string {
        return `${config.app.baseUrl}/unsubscribe/${recipientId}`;
    }

    private async processAttachments(attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
    }>) {
        if (!attachments?.length) return undefined;

        return attachments.map(attachment => {
            const buffer = Buffer.from(attachment.content, 'base64');

            if (buffer.length > this.maxAttachmentSize) {
                throw new ValidationError(
                    `Attachment ${attachment.filename} exceeds maximum size of ${this.maxAttachmentSize / (1024 * 1024)}MB`
                );
            }

            return {
                filename: attachment.filename,
                content: attachment.content,
                type: attachment.contentType,
                disposition: 'attachment'
            };
        });
    }

    async handleWebhookEvent(event: any): Promise<void> {
        if (!event || !event.event) {
            logger.warn('Invalid webhook event received', { event });
            return;
        }

        const { notificationId } = event?.customArgs || {};

        if (!notificationId) {
            logger.warn('Received webhook event without notificationId', { event });
            return;
        }

        switch (event.event) {
            case 'delivered':
                notificationCounter.inc({ channel: 'email', status: 'delivered' });
                break;
            case 'opened':
                notificationCounter.inc({ channel: 'email', status: 'opened' });
                break;
            case 'clicked':
                notificationCounter.inc({ channel: 'email', status: 'clicked' });
                break;
            case 'bounce':
            case 'dropped':
                notificationCounter.inc({ channel: 'email', status: 'failed' });
                break;
            default:
                logger.info('Unhandled email event type', {
                    eventType: event.event,
                    notificationId
                });
        }

        logger.info('Email event received', {
            notificationId,
            eventType: event.event,
            timestamp: event.timestamp,
            email: event.email,
            reason: event.reason || 'none'
        });
    }
}