import { SMSTemplateService } from '../../../src/services/sms.template.service';
import { TemplateName } from '../../../src/templates/template-registry';

describe('SMSTemplateService', () => {
    let templateService: SMSTemplateService;

    beforeEach(async () => {
        templateService = new SMSTemplateService();
        await templateService['initialize'](); // Access private method for testing
    });

    describe('renderTemplate', () => {
        it('should render alert template correctly', () => {
            const data = {
                alertType: 'Security',
                message: 'Unusual login detected',
                referenceId: 'SEC-123',
                urgency: 'High',
                actionRequired: 'Verify login attempt'
            };

            const result = templateService.renderTemplate('alert', data);

            expect(result).toContain('Security Alert');
            expect(result).toContain('Unusual login detected');
            expect(result).toContain('SEC-123');
            expect(result).toContain('High');
            expect(result).toContain('Verify login attempt');
        });

        it('should render verification template correctly', () => {
            const data = {
                companyName: 'Test Company',
                code: '123456',
                purpose: 'verify your account',
                expiryMinutes: 15
            };

            const result = templateService.renderTemplate('verification', data);

            expect(result).toContain('Test Company');
            expect(result).toContain('123456');
            expect(result).toContain('15 minutes');
            expect(result).toContain('DO NOT share');
        });

        it('should throw error for missing required fields', () => {
            const data = {
                alertType: 'Security',
                // message is missing
                referenceId: 'SEC-123'
            };

            // @ts-ignore
            expect(() => templateService.renderTemplate('alert', data))
                .toThrow('Missing required fields');
        });

        it('should throw error for non-existent template', () => {
            // @ts-ignore
            expect(() => templateService.renderTemplate('non-existent' as TemplateName, {}))
                .toThrow('Template not found');
        });

        it('should handle conditional sections correctly', () => {
            const data = {
                recipientName: 'John',
                message: 'Your order is ready',
                callToAction: {
                    text: 'View Order',
                    url: 'https://example.com/order'
                }
            };

            const result = templateService.renderTemplate('notification', data);

            expect(result).toContain('John');
            expect(result).toContain('Your order is ready');
            expect(result).toContain('View Order');
            expect(result).toContain('https://example.com/order');
        });

        it('should warn when rendered content exceeds SMS length limit', () => {
            const longMessage = 'a'.repeat(2000);
            const data = {
                alertType: 'Test',
                message: longMessage,
                referenceId: 'TEST-123'
            };

            const consoleSpy = jest.spyOn(console, 'warn');
            templateService.renderTemplate('alert', data);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('exceeds recommended length')
            );
        });
    });

    describe('validateTemplateData', () => {
        it('should validate required fields correctly', () => {
            const validData = {
                alertType: 'Security',
                message: 'Test message',
                referenceId: 'SEC-123'
            };

            expect(templateService.validateTemplateData('alert', validData)).toBe(true);
        });

        it('should fail validation for missing fields', () => {
            const invalidData = {
                alertType: 'Security',
                // message is missing
                referenceId: 'SEC-123'
            };

            // @ts-ignore
            expect(() => templateService.validateTemplateData('alert', invalidData))
                .toThrow('Missing required fields');
        });
    });

    describe('getTemplatePreview', () => {
        it('should generate preview with sample data', () => {
            const preview = templateService.getTemplatePreview('alert');

            expect(preview).toContain('Alert');
            expect(preview).toContain('sample');
            expect(preview).not.toContain('{{');
            expect(preview).not.toContain('}}');
        });

        it('should generate different previews for different templates', () => {
            const alertPreview = templateService.getTemplatePreview('alert');
            const verificationPreview = templateService.getTemplatePreview('verification');

            expect(alertPreview).not.toEqual(verificationPreview);
        });
    });
});