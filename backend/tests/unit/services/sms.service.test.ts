import { SMSService } from '../../../src/services/sms.service';
import { NotificationChannel } from '../../../src/types/notification';
import { ValidationError } from '../../../src/types/errors';
import { createTestNotification } from '../../setup';
import { notificationCounter } from '../../../src/monitoring/metrics';
import config from '../../../src/config';
import '../../mocks/sms-templates';

// Mock Twilio
const mockTwilioMessages = {
    create: jest.fn().mockResolvedValue({
        sid: 'test_message_id',
        status: 'queued'
    })
};

const mockTwilioClient = {
    messages: mockTwilioMessages
};

jest.mock('twilio', () => ({
    Twilio: jest.fn().mockImplementation(() => mockTwilioClient)
}));

// Mock metrics
jest.mock('../../../src/monitoring/metrics', () => ({
    notificationCounter: {
        inc: jest.fn()
    },
    notificationDuration: {
        startTimer: jest.fn().mockReturnValue(jest.fn())
    }
}));

describe('SMSService', () => {
    let smsService: SMSService;

    beforeEach(() => {
        jest.clearAllMocks();
        smsService = new SMSService();
    });

    describe('sendSMS', () => {
        it('should successfully send an SMS', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890',
                    metadata: { name: 'Test User' }
                }]
            });

            const result = await smsService.sendSMS(notification);

            expect(result).toBe(true);
            expect(mockTwilioMessages.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: '+1234567890',
                    from: config.sms.fromNumber,
                    body: notification.content.body,
                    statusCallback: expect.stringContaining('/api/v1/webhooks/sms/status/')
                })
            );
            expect(notificationCounter.inc).toHaveBeenCalledWith({
                channel: 'sms',
                status: 'success'
            });
        });

        it('should handle multiple recipients', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [
                    {
                        id: '123',
                        channel: NotificationChannel.SMS,
                        destination: '+1234567890',
                        metadata: { name: 'User 1' }
                    },
                    {
                        id: '124',
                        channel: NotificationChannel.SMS,
                        destination: '+1987654321',
                        metadata: { name: 'User 2' }
                    }
                ]
            });

            const result = await smsService.sendSMS(notification);

            expect(result).toBe(true);
            expect(mockTwilioMessages.create).toHaveBeenCalledTimes(2);
            expect(mockTwilioMessages.create).toHaveBeenCalledWith(
                expect.objectContaining({ to: '+1234567890' })
            );
            expect(mockTwilioMessages.create).toHaveBeenCalledWith(
                expect.objectContaining({ to: '+1987654321' })
            );
            expect(notificationCounter.inc).toHaveBeenCalledWith({
                channel: 'sms',
                status: 'success'
            });
        });

        it('should throw ValidationError for invalid phone numbers', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: 'invalid-number',
                    metadata: { name: 'Test User' }
                }]
            });

            await expect(smsService.sendSMS(notification))
                .rejects
                .toThrow(ValidationError);

            expect(mockTwilioMessages.create).not.toHaveBeenCalled();
            expect(notificationCounter.inc).not.toHaveBeenCalled();
        });

        it('should retry on Twilio errors', async () => {
            mockTwilioMessages.create
                .mockRejectedValueOnce(new Error('Twilio Error'))
                .mockRejectedValueOnce(new Error('Twilio Error'))
                .mockResolvedValueOnce({
                    sid: 'test_message_id',
                    status: 'queued'
                });

            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890',
                    metadata: { name: 'Test User' }
                }]
            });

            const result = await smsService.sendSMS(notification);

            expect(result).toBe(true);
            expect(mockTwilioMessages.create).toHaveBeenCalledTimes(3);
            expect(notificationCounter.inc).toHaveBeenCalledWith({
                channel: 'sms',
                status: 'success'
            });
        });

        it('should handle rate limit errors', async () => {
            const rateLimitError = new Error('Rate limit exceeded') as any;
            rateLimitError.code = 29;
            rateLimitError.status = 429;

            mockTwilioMessages.create.mockRejectedValue(rateLimitError);

            const notification = createTestNotification({
                channel: NotificationChannel.SMS
            });

            await expect(smsService.sendSMS(notification))
                .rejects
                .toThrow('Rate limit exceeded');

            expect(mockTwilioMessages.create)
                .toHaveBeenCalledTimes(config.sms.maxRetries + 1);
            expect(notificationCounter.inc).toHaveBeenCalledWith({
                channel: 'sms',
                status: 'failure'
            });
        });

        it('should handle template rendering', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890'
                }],
                content: {
                    subject: 'Verification Code', // optional
                    body: 'Your verification code is: {{code}}', // required field
                    templateId: 'verification',
                    templateData: {
                        code: '123456',
                        purpose: 'login',
                        expiryMinutes: 5,
                        companyName: 'Test Company' // required for verification template
                    }
                }
            });

            await smsService.sendSMS(notification);

            expect(mockTwilioMessages.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: expect.stringContaining('123456'),
                }),
                expect.objectContaining({
                    body: expect.stringContaining('Test Company'), // verify company name is included
                }),
                expect.objectContaining({
                    body: expect.stringContaining('5 minutes') // verify expiry time is included
                })
            );

            // Verify template was properly rendered
            expect(mockTwilioMessages.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: expect.not.stringContaining('{{'), // No unrendered template variables
                }),
                expect.objectContaining({
                    body: expect.not.stringContaining('}}')
                })
            );
        });

// Add test for template rendering errors
        it('should handle template rendering errors', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890'
                }],
                content: {
                    body: 'Your verification code is: {{code}}',
                    templateId: 'verification',
                    templateData: {
                        // Missing required template data
                        purpose: 'login',
                        expiryMinutes: 5
                    }
                }
            });

            await expect(smsService.sendSMS(notification))
                .rejects
                .toThrow(/missing required template data/i);

            expect(mockTwilioMessages.create).not.toHaveBeenCalled();
        });

// Add test for unknown template
        it('should handle unknown template IDs', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890'
                }],
                content: {
                    body: 'Test message',
                    templateId: 'non-existent-template',
                    templateData: {
                        someData: 'test'
                    }
                }
            });

            await expect(smsService.sendSMS(notification))
                .rejects
                .toThrow(/template not found/i);

            expect(mockTwilioMessages.create).not.toHaveBeenCalled();
        });

// Add test for fallback to body content when no template
        it('should use body content when no template is specified', async () => {
            const directMessage = 'Direct message without template';
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890'
                }],
                content: {
                    body: directMessage
                }
            });

            await smsService.sendSMS(notification);

            expect(mockTwilioMessages.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: directMessage
                })
            );
        });
    });

    describe('handleWebhookEvent', () => {
        it('should process delivery event', async () => {
            const event = {
                MessageSid: 'test_message_id',
                MessageStatus: 'delivered',
                To: '+1234567890'
            };

            await smsService.handleWebhookEvent(event);

            expect(notificationCounter.inc).toHaveBeenCalledWith({
                channel: 'sms',
                status: 'delivered'
            });
        });

        it('should handle failed delivery event', async () => {
            const event = {
                MessageSid: 'test_message_id',
                MessageStatus: 'failed',
                To: '+1234567890',
                ErrorCode: '30001'
            };

            await smsService.handleWebhookEvent(event);

            expect(notificationCounter.inc).toHaveBeenCalledWith({
                channel: 'sms',
                status: 'failed'
            });
        });

        it('should handle undelivered status', async () => {
            const event = {
                MessageSid: 'test_message_id',
                MessageStatus: 'undelivered',
                To: '+1234567890',
                ErrorCode: '30002'
            };

            await smsService.handleWebhookEvent(event);

            expect(notificationCounter.inc).toHaveBeenCalledWith({
                channel: 'sms',
                status: 'failed'
            });
        });

        it('should ignore invalid webhook events', async () => {
            const invalidEvent = {};
            await smsService.handleWebhookEvent(invalidEvent);
            expect(notificationCounter.inc).not.toHaveBeenCalled();
        });

        it('should handle message queued status', async () => {
            const event = {
                MessageSid: 'test_message_id',
                MessageStatus: 'queued',
                To: '+1234567890'
            };

            await smsService.handleWebhookEvent(event);

            expect(notificationCounter.inc).toHaveBeenCalledWith({
                channel: 'sms',
                status: 'queued'
            });
        });
    });
});