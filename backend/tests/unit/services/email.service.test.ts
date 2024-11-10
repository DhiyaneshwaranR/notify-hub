// @ts-ignore
import sgMail, {MailDataRequired} from '@sendgrid/mail';
import config from '../../../src/config';
import { EmailService } from '../../../src/services/email.service';
import { TemplateService } from '../../../src/services/template.service';
import { ValidationError } from '../../../src/types/errors';
import { createTestNotification } from '../../setup';
import {NotificationChannel} from "../../../src/types/notification";
import {notificationCounter} from "../../../src/monitoring/metrics";

jest.mock('../../../src/services/template.service');

describe('EmailService', () => {
    let emailService: EmailService;
    let sendgridSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        (TemplateService.prototype.loadTemplates as jest.Mock).mockResolvedValue(undefined);
        (TemplateService.prototype.renderTemplate as jest.Mock).mockResolvedValue('<html>Test Email</html>');
        emailService = new EmailService();

        // Spy on SendGrid's send method
        sendgridSpy = jest.spyOn(sgMail, 'send').mockImplementation(async ( ) => {
            return [{
                statusCode: 202,
                headers: {
                    'x-message-id': 'test-message-id'
                },
                body: {}
            }, {}];
        });
    });

    describe('sendEmail', () => {
        it('should successfully send an email in sandbox mode', async () => {
            const notification = createTestNotification();

            const result = await emailService.sendEmail(notification);

            expect(result).toBe(true);
            expect(sendgridSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    mailSettings: {
                        sandboxMode: {
                            enable: true
                        }
                    }
                })
            );
        });

        it('should handle multiple recipients', async () => {
            const notification = createTestNotification({
                recipients: [
                    {
                        id: '123',
                        channel: NotificationChannel.EMAIL,
                        destination: 'test1@example.com',
                        metadata: { name: 'Test User 1' }
                    },
                    {
                        id: '124',
                        channel: NotificationChannel.EMAIL,
                        destination: 'test2@example.com',
                        metadata: { name: 'Test User 2' }
                    }
                ]
            });

            const result = await emailService.sendEmail(notification);

            expect(result).toBe(true);
            expect(sendgridSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: expect.arrayContaining([
                        { email: 'test1@example.com', name: 'Test User 1' },
                        { email: 'test2@example.com', name: 'Test User 2' }
                    ]),
                    mailSettings: {
                        sandboxMode: {
                            enable: true
                        }
                    }
                })
            );
        });

        it('should throw ValidationError for invalid email addresses', async () => {
            const notification = createTestNotification();
            notification.recipients[0].destination = 'invalid-email';

            await expect(emailService.sendEmail(notification))
                .rejects
                .toThrow(ValidationError);
        },120000);

        it('should handle notifications with attachments', async () => {
            const notification = createTestNotification({
                content: {
                    subject: 'Test with attachment',
                    body: 'Test body',
                    attachments: [{
                        filename: 'test.txt',
                        content: Buffer.from('test content').toString('base64'),
                        contentType: 'text/plain'
                    }]
                }
            });

            const result = await emailService.sendEmail(notification);

            expect(result).toBe(true);
            expect(sendgridSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            filename: 'test.txt',
                            type: 'text/plain'
                        })
                    ]),
                    mailSettings: {
                        sandboxMode: {
                            enable: true
                        }
                    }
                })
            );
        });

        it('should respect template data', async () => {
            const notification = createTestNotification({
                content: {
                    subject: 'Test with template',
                    body: 'Test body',
                    templateId: 'test-template',
                    templateData: {
                        name: 'John Doe',
                        action_url: 'https://example.com'
                    }
                }
            });

            const result = await emailService.sendEmail(notification);

            expect(result).toBe(true);
            expect(TemplateService.prototype.renderTemplate).toHaveBeenCalledWith(
                'notification',
                expect.objectContaining({
                    title: notification.content.subject,
                    message: notification.content.body
                })
            );
            expect(sendgridSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    mailSettings: {
                        sandboxMode: {
                            enable: true
                        }
                    }
                })
            );
        });

        it('should handle SendGrid errors and respect retry logic', async () => {
            // Mock SendGrid to fail for all attempts
            sendgridSpy.mockRejectedValue(new Error('SendGrid API Error'));

            const notification = createTestNotification();

            // Since EmailService is configured to retry multiple times,
            // we need to wait for all retries to complete
            await expect(emailService.sendEmail(notification)).rejects.toThrow('SendGrid API Error');

            // Verify that send was called maxRetries + 1 times (initial attempt + retries)
            expect(sendgridSpy).toHaveBeenCalledTimes(config.email.maxRetries + 1);

            // Verify each call included sandbox mode
            const calls = (sendgridSpy.mock.calls as Array<[MailDataRequired]>);
            calls.forEach(([mailData]) => {
                expect(mailData.mailSettings?.sandboxMode?.enable).toBe(true);
            });
        }, 30000); // Increased timeout to account for retry delays

        it('should retry on failure but eventually succeed', async () => {
            // Mock SendGrid to fail twice then succeed
            sendgridSpy
                .mockRejectedValueOnce(new Error('SendGrid API Error'))
                .mockRejectedValueOnce(new Error('SendGrid API Error'))
                .mockResolvedValueOnce([{
                    statusCode: 202,
                    headers: {
                        'x-message-id': 'test-message-id'
                    },
                    body: {}
                }, {}]);

            const notification = createTestNotification();

            const result = await emailService.sendEmail(notification);

            expect(result).toBe(true);
            expect(sendgridSpy).toHaveBeenCalledTimes(3); // Two failures + one success
        }, 30000);

        it('should handle specific SendGrid error types', async () => {
            // Mock a rate limit error from SendGrid
            const rateLimitError = new Error('Rate limit exceeded') as any;
            rateLimitError.code = 429;
            rateLimitError.response = {
                headers: {
                    'x-ratelimit-reset': '1619794400'
                }
            };

            sendgridSpy.mockRejectedValue(rateLimitError);

            const notification = createTestNotification();

            await expect(emailService.sendEmail(notification))
                .rejects
                .toThrow('Rate limit exceeded');

            // Should attempt maxRetries + 1 times
            expect(sendgridSpy).toHaveBeenCalledTimes(config.email.maxRetries + 1);
        }, 30000);

        it('should handle network timeouts', async () => {
            // Mock a network timeout error
            const timeoutError = new Error('Connection timeout');
            timeoutError.name = 'TimeoutError';

            sendgridSpy.mockRejectedValue(timeoutError);

            const notification = createTestNotification();

            await expect(emailService.sendEmail(notification))
                .rejects
                .toThrow('Connection timeout');

            // Should attempt maxRetries + 1 times
            expect(sendgridSpy).toHaveBeenCalledTimes(config.email.maxRetries + 1);
        }, 30000);

        it('should increment error metrics on failure', async () => {
            const metricsCounterSpy = jest.spyOn(notificationCounter, 'inc');

            sendgridSpy.mockRejectedValue(new Error('SendGrid API Error'));

            const notification = createTestNotification();

            await expect(emailService.sendEmail(notification)).rejects.toThrow();

            expect(metricsCounterSpy).toHaveBeenCalledWith({
                channel: 'email',
                status: 'failure'
            });
        },30000);
    });

    describe('handleWebhookEvent', () => {
        it('should process delivery event', async () => {
            const event = {
                event: 'delivered',
                customArgs: {
                    notificationId: '123'
                },
                email: 'test@example.com',
                timestamp: 1234567890
            };

            await emailService.handleWebhookEvent(event);
        });

        it('should handle bounce events', async () => {
            const event = {
                event: 'bounce',
                customArgs: {
                    notificationId: '123'
                },
                email: 'test@example.com',
                timestamp: 1234567890,
                reason: 'Test bounce reason'
            };

            await emailService.handleWebhookEvent(event);
        });

        it('should handle invalid webhook events', async () => {
            const invalidEvent = {};
            await emailService.handleWebhookEvent(invalidEvent);
        });
    });
});