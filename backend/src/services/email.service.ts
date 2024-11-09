import sgMail from '@sendgrid/mail';
import config from '../config';
import logger from '../utils/logger';
import { NotificationRequest } from '../types/notification';
import { TemplateService, TemplateData } from './template.service';
import { notificationCounter, notificationDuration } from '../monitoring/metrics';

export class EmailService {
    private templateService: TemplateService;

    constructor() {
        sgMail.setApiKey(config.email.sendgridApiKey);
        this.templateService = new TemplateService();
        this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.templateService.loadTemplates();
    }

    async sendEmail(notification: NotificationRequest): Promise<boolean> {
        const timer = notificationDuration.startTimer({ channel: 'email' });

        try {
            const templateData: TemplateData = {
                title: notification.content.subject,
                message: notification.content.body,
                actionButton: notification.content.actionButton,
                unsubscribeLink: `${config.app.baseUrl}/unsubscribe/${notification.recipients[0].id}`
            };

            const htmlContent = await this.templateService.renderTemplate(
                'notification',
                templateData
            );

            const msg = {
                to: notification.recipients.map(r => r.destination),
                from: config.email.fromEmail,
                subject: notification.content.subject,
                text: notification.content.body,
                html: htmlContent
            };

            await sgMail.send(msg);

            notificationCounter.inc({ channel: 'email', status: 'success' });
            logger.info('Email sent successfully', { notificationId: notification.id });

            return true;
        } catch (error) {
            notificationCounter.inc({ channel: 'email', status: 'failure' });
            logger.error('Failed to send email', {
                notificationId: notification.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        } finally {
            timer();
        }
    }
}