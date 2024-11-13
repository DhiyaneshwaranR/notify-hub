import Handlebars from 'handlebars';
import { templateHelpers } from './template.helpers';
import logger from '../utils/logger';

export const registerHelpers = (): void => {
    try {
        // Date and Time Helpers
        Handlebars.registerHelper('formatDate', templateHelpers.formatDate);
        Handlebars.registerHelper('formatTime', templateHelpers.formatTime);
        Handlebars.registerHelper('formatDateTime', templateHelpers.formatDateTime);

        // Text Formatting Helpers
        Handlebars.registerHelper('truncate', templateHelpers.truncate);
        Handlebars.registerHelper('capitalize', templateHelpers.capitalize);

        // Phone Number Formatting
        Handlebars.registerHelper('formatPhoneNumber', templateHelpers.formatPhoneNumber);

        // Number Formatting
        Handlebars.registerHelper('formatNumber', templateHelpers.formatNumber);
        Handlebars.registerHelper('formatCurrency', templateHelpers.formatCurrency);

        // Conditional Helpers
        Handlebars.registerHelper('ifEquals', templateHelpers.ifEquals);
        Handlebars.registerHelper('ifNotEquals', templateHelpers.ifNotEquals);
        Handlebars.registerHelper('includes', templateHelpers.includes);

        // URL Helpers
        Handlebars.registerHelper('formatUrl', templateHelpers.formatUrl);

        // Template-specific Helpers
        Handlebars.registerHelper('getSalutation', templateHelpers.getSalutation);
        Handlebars.registerHelper('formatMessagePreview', templateHelpers.formatMessagePreview);

        logger.info('Template helpers registered successfully');
    } catch (error) {
        logger.error('Failed to register template helpers', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
};