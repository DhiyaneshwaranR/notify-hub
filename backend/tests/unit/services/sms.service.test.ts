import { SMSService } from '../../../src/services/sms.service';
import { NotificationChannel } from '../../../src/types/notification';
import { ValidationError } from '../../../src/types/errors';
import { createTestNotification } from '../../setup';
import { setupTestDB, teardownTestDB, clearCollections } from '../../setup';
import { notificationCounter } from '../../../src/monitoring/metrics';
import config from '../../../src/config';
import '../../mocks/sms-templates';
import { TemplateName } from '../../../src/templates/template-registry';
import {SMSTrackingService} from "../../../src/services/sms-tracking.service";
import {SMSStatus} from "../../../src/types/sms";

// Mock SMSTrackingService
jest.mock('../../../src/services/sms-tracking.service');

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
    let trackingServiceMock: jest.Mocked<SMSTrackingService>;

    beforeAll(async () => {
        smsService = new SMSService();

        await setupTestDB();
        // Timeout for templates to be
        await new Promise(resolve => setTimeout(resolve, 20000));

    },50000);

    beforeEach(async () => {
        await clearCollections();
        jest.clearAllMocks();

        // Setup tracking service mock
        trackingServiceMock = {
            createTracking: jest.fn().mockResolvedValue({}),
            updateStatus: jest.fn().mockResolvedValue({}),
            getTrackingInfo: jest.fn().mockResolvedValue(null)
        } as any;

        // Initialize service with mocked tracking
        smsService = new SMSService();
        (smsService as any).trackingService = trackingServiceMock;
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    afterAll(async () => {
        await teardownTestDB();
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
        },30000);

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
        }, 15000);

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
        },15000);

        it('should handle rate limit errors', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890'
                }]
            });

            const rateLimitError = new Error('Rate limit exceeded') as any;
            rateLimitError.code = 29;
            rateLimitError.status = 429;
            mockTwilioMessages.create.mockRejectedValueOnce(rateLimitError);
            mockTwilioMessages.create.mockRejectedValueOnce(rateLimitError);
            mockTwilioMessages.create.mockRejectedValueOnce(rateLimitError);
            mockTwilioMessages.create.mockRejectedValueOnce(rateLimitError);
            mockTwilioMessages.create.mockRejectedValueOnce(rateLimitError);
            mockTwilioMessages.create.mockRejectedValueOnce(rateLimitError);

            await expect(smsService.sendSMS(notification))
                .rejects
                .toThrow('Rate limit exceeded');

            expect(mockTwilioMessages.create)
                .toHaveBeenCalledTimes(config.sms.maxRetries + 1);
        }, 30000);

        it('should handle template rendering', async () => {
            const notification = createTestNotification({
                channel: NotificationChannel.SMS,
                recipients: [{
                    id: '123',
                    channel: NotificationChannel.SMS,
                    destination: '+1234567890'
                }],
                content: {
                    body: 'System outage detected',
                    templateId: 'alert' as TemplateName,
                    templateData: {
                        alertType: 'System',
                        message: 'System outage detected',
                        referenceId: 'INC123'
                    }
                }
            });

            await smsService.sendSMS(notification);

            expect(mockTwilioMessages.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: '+1234567890',
                    body: '🚨 System Alert:\n' +
                        'System outage detected\n' +
                        'Ref: INC123'
                })
            );

        },15000);

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
                .toThrow(/Missing required fields for template/i);

            expect(mockTwilioMessages.create).not.toHaveBeenCalled();
        },30000);

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
                .toThrow("Template 'non-existent-template' not found");

            expect(mockTwilioMessages.create).not.toHaveBeenCalled();

        },30000);

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
        },20000);
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
                status: SMSStatus.DELIVERED
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
                status: SMSStatus.FAILED
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
                status: SMSStatus.UNDELIVERED
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
                status: SMSStatus.QUEUED
            });
        });
    });
});