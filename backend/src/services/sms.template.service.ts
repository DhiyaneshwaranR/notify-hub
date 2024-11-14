import Handlebars from 'handlebars';
import {
    templateRegistry,
    TemplateName,
    SMSTemplateData
} from '../templates/template-registry';
import { registerHelpers } from '../helpers/register-helpers';
import logger from '../utils/logger';

export class SMSTemplateService {
    private compiledTemplates: Map<TemplateName, HandlebarsTemplateDelegate> = new Map();
    private readonly SMS_LENGTH_LIMIT = 1600; // SMS segment limit

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            // Register template helpers
            registerHelpers();

            // Load and compile templates
            await templateRegistry.loadTemplates();

            for (const templateName of templateRegistry.getTemplateNames()) {
                const templateContent = templateRegistry.getTemplate(templateName);
                this.compiledTemplates.set(
                    templateName,
                    Handlebars.compile(templateContent)
                );
            }

            logger.info('SMS templates initialized successfully', {
                templateCount: this.compiledTemplates.size,
                availableTemplates: Array.from(this.compiledTemplates.keys())
            });
        } catch (error) {
            logger.error('Failed to initialize SMS templates', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    public renderTemplate(
        templateName: TemplateName,
        data: SMSTemplateData[TemplateName]
    ): string {
        const template = this.compiledTemplates.get(templateName);
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }

        try {
            // Validate data before rendering
            this.validateTemplateData(templateName, data);

            // Render template
            const rendered = template(data);

            // Check message length and warn if too long
            if (rendered.length > this.SMS_LENGTH_LIMIT) {
                const segments = Math.ceil(rendered.length / 160);
                const warningMessage = `SMS template rendered content exceeds recommended length`;
                logger.warn(warningMessage, {
                    templateName,
                    length: rendered.length,
                    segments
                });
                console.warn(warningMessage, {
                    templateName,
                    length: rendered.length,
                    segments
                });
            }

            return rendered;
        } catch (error) {
            logger.error('Failed to render SMS template', {
                error: error instanceof Error ? error.message : 'Unknown error',
                templateName,
                dataKeys: Object.keys(data)
            });
            throw error;
        }
    }

    public validateTemplateData(
        templateName: TemplateName,
        data: SMSTemplateData[TemplateName]
    ): boolean {
        const requiredFields = this.getRequiredFields(templateName);
        const missing = requiredFields.filter(field => !data[field as keyof typeof data]);

        if (missing.length > 0) {
            throw new Error(`Missing required fields for template '${templateName}': ${missing.join(', ')}`);
        }

        return true;
    }

    private getRequiredFields(templateName: TemplateName): string[] {
        const requirements: Record<TemplateName, string[]> = {
            basic: [ 'message'],
            alert: ['alertType', 'message', 'referenceId'],
            verification: ['code', 'purpose', 'expiryMinutes'],
            notification: ['recipientName', 'message'],
            reminder: ['eventName', 'dateTime'],
            marketing: ['offerHeadline', 'offerDetails']
        };

        return requirements[templateName] || [];
    }

    public getTemplatePreview(templateName: TemplateName): string {
        const sampleData = templateRegistry.getDefaultData(templateName);
        return this.renderTemplate(templateName, sampleData);
    }
}