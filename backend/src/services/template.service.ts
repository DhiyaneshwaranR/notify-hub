import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import logger from '../utils/logger';

export interface TemplateData {
    title?: string;
    subject?: string;
    message?: string;
    actionButton?: {
        text: string;
        url: string;
    };
    footer?: string;
    unsubscribeLink?: string;
}

export class TemplateService {
    private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
    private readonly templatesDir: string;

    constructor() {
        this.templatesDir = path.join(__dirname, '../templates/email');
    }

    async loadTemplates(): Promise<void> {
        try {
            const baseTemplate = await fs.readFile(
                path.join(this.templatesDir, 'base.hbs'),
                'utf-8'
            );

            Handlebars.registerPartial('base', baseTemplate);

            const files = await fs.readdir(this.templatesDir);

            for (const file of files) {
                if (file === 'base.hbs') continue;

                const templateContent = await fs.readFile(
                    path.join(this.templatesDir, file),
                    'utf-8'
                );

                const templateName = path.basename(file, '.hbs');
                this.templates.set(templateName, Handlebars.compile(templateContent));
            }

            logger.info('Email templates loaded successfully');
        } catch (error) {
            logger.error('Failed to load email templates', { error });
            throw error;
        }
    }

    async renderTemplate(
        templateName: string,
        data: TemplateData
    ): Promise<string> {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        const content = template(data);
        const baseTemplate = Handlebars.partials['base'];

        if (!baseTemplate || typeof baseTemplate !== 'function') {
            throw new Error('Base template not found or invalid');
        }

        return baseTemplate({
            ...data,
            content,
            unsubscribeLink: data.unsubscribeLink || '#',
            footer: data.footer || '© 2024 Notify Hub. All rights reserved.'
        });
    }
}