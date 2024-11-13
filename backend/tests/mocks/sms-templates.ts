// tests/mocks/sms-templates.ts

export const mockTemplates = {
    alert: `🚨 {{alertType}} Alert:
{{message}}
{{#if actionRequired}}
Action Required: {{actionRequired}}
{{/if}}
{{#if urgency}}
Urgency: {{urgency}}
{{/if}}
Ref: {{referenceId}}`,

    verification: `{{companyName}} Verification Code: {{code}}
Use this code to {{purpose}}
Code expires in {{expiryMinutes}} minutes.
DO NOT share this code with anyone.`,

    notification: `{{#if greeting}}{{greeting}}{{else}}Hi{{/if}} {{recipientName}},
{{message}}
{{#if callToAction}}
{{callToAction.text}}: {{callToAction.url}}
{{/if}}`,

    reminder: `Reminder: {{eventName}}
📅 {{dateTime}}
{{#if location}}📍 {{location}}{{/if}}
{{#if additionalInfo}}
{{additionalInfo}}
{{/if}}`,

    marketing: `{{offerHeadline}}
{{offerDetails}}
{{#if promoCode}}
Use code: {{promoCode}}
{{/if}}
{{#if validUntil}}
Valid until: {{validUntil}}
{{/if}}
{{#if termsAndConditions}}
T&C: {{termsAndConditions}}
{{/if}}
Reply STOP to unsubscribe`
};

// Mock the template loading functions
jest.mock('fs/promises', () => ({
    readdir: jest.fn().mockResolvedValue([
        'alert.hbs',
        'verification.hbs',
        'notification.hbs',
        'reminder.hbs',
        'marketing.hbs'
    ]),
    readFile: jest.fn().mockImplementation((path) => {
        const templateName = path.split('/').pop()?.replace('.hbs', '') as keyof typeof mockTemplates;
        return Promise.resolve(mockTemplates[templateName] || '');
    })
}));