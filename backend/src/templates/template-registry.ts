import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

export interface SMSTemplateData {
    alert: {
        alertType: string;
        message: string;
        referenceId: string;
        actionRequired?: string;
        urgency?: string;
    };
    verification: {
        companyName: string;
        code: string;
        purpose: string;
        expiryMinutes: number;
    };
    notification: {
        greeting?: string;
        recipientName: string;
        message: string;
        callToAction?: {
            text: string;
            url: string;
        };
    };
    reminder: {
        eventName: string;
        dateTime: Date | string;
        location?: string;
        additionalInfo?: string;
    };
    marketing: {
        offerHeadline: string;
        offerDetails: string;
        promoCode?: string;
        validUntil?: Date | string;
        termsAndConditions?: string;
    };
}

export type TemplateName = keyof SMSTemplateData;

export class TemplateRegistry {
    private templates: Map<TemplateName, string> = new Map();
    private readonly templatesDir: string;

    constructor() {
        this.templatesDir = path.join(__dirname, 'templates');
    }

    async loadTemplates(): Promise<void> {
        try {
            const files = await fs.readdir(this.templatesDir);

            for (const file of files) {
                if (file.endsWith('.hbs')) {
                    const templateName = file.replace('.hbs', '') as TemplateName;
                    const templateContent = await fs.readFile(
                        path.join(this.templatesDir, file),
                        'utf-8'
                    );
                    this.templates.set(templateName, templateContent);
                }
            }

            logger.info('SMS templates loaded successfully', {
                templateCount: this.templates.size,
                templates: Array.from(this.templates.keys())
            });
        } catch (error) {
            logger.error('Failed to load SMS templates', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    getTemplate(name: TemplateName): string {
        const template = this.templates.get(name);
        if (!template) {
            throw new Error(`Template '${name}' not found`);
        }
        return template;
    }

    getTemplateNames(): TemplateName[] {
        return Array.from(this.templates.keys());
    }

    getDefaultData(templateName: TemplateName): SMSTemplateData[TemplateName] {
        const defaults: SMSTemplateData = {
            alert: {
                alertType: 'System',
                message: 'Sample alert message',
                referenceId: 'REF123',
                actionRequired: 'Check system status',
                urgency: 'High'
            },
            verification: {
                companyName: 'ACME Corp',
                code: '123456',
                purpose: 'verify your account',
                expiryMinutes: 15
            },
            notification: {
                greeting: 'Hello',
                recipientName: 'John',
                message: 'Your order has been confirmed',
                callToAction: {
                    text: 'Track your order',
                    url: 'https://example.com/track'
                }
            },
            reminder: {
                eventName: 'Team Meeting',
                dateTime: new Date().toISOString(),
                location: 'Conference Room A',
                additionalInfo: 'Bring your laptop'
            },
            marketing: {
                offerHeadline: 'Special Offer!',
                offerDetails: '20% off all products',
                promoCode: 'SAVE20',
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                termsAndConditions: 'Some restrictions apply'
            }
        };

        return defaults[templateName];
    }
}

export const templateRegistry = new TemplateRegistry();