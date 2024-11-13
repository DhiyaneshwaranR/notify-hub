import { format, isValid } from 'date-fns';
import logger from '../utils/logger';

export interface TemplateHelperOptions {
    locale?: string;
    timezone?: string;
}

export class TemplateHelpers {
    private defaultLocale: string;
    // @ts-ignore
    private defaultTimezone: string;

    constructor(options: TemplateHelperOptions = {}) {
        this.defaultLocale = options.locale || 'en-US';
        this.defaultTimezone = options.timezone || 'UTC';
    }

    /**
     * Date and Time Helpers
     */
    formatDate = (date: string | Date, formatStr = 'MMM dd, yyyy'): string => {
        try {
            const dateObj = typeof date === 'string' ? new Date(date) : date;
            if (!isValid(dateObj)) {
                throw new Error('Invalid date');
            }
            return format(dateObj, formatStr);
        } catch (error) {
            logger.error('Date formatting error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                date,
                format: formatStr
            });
            return String(date);
        }
    };

    formatTime = (date: string | Date, formatStr = 'hh:mm a'): string => {
        try {
            const dateObj = typeof date === 'string' ? new Date(date) : date;
            if (!isValid(dateObj)) {
                throw new Error('Invalid date');
            }
            return format(dateObj, formatStr);
        } catch (error) {
            logger.error('Time formatting error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                date,
                format: formatStr
            });
            return String(date);
        }
    };

    formatDateTime = (date: string | Date, formatStr = 'MMM dd, yyyy hh:mm a'): string => {
        return this.formatDate(date, formatStr);
    };

    /**
     * Text Formatting Helpers
     */
    truncate = (text: string, length: number, suffix = '...'): string => {
        try {
            if (text.length <= length) return text;
            return text.substring(0, length - suffix.length) + suffix;
        } catch (error) {
            logger.error('Text truncation error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                textLength: text?.length,
                requestedLength: length
            });
            return text;
        }
    };

    capitalize = (text: string): string => {
        try {
            return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
        } catch (error) {
            logger.error('Capitalization error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                text
            });
            return text;
        }
    };

    /**
     * Phone Number Formatting
     */
    formatPhoneNumber = (phone: string, country = 'US'): string => {
        try {
            const cleaned = phone.replace(/\D/g, '');
            switch (country) {
                case 'US':
                    const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
                    if (match) {
                        const intlCode = match[1] ? '+1 ' : '';
                        return `${intlCode}(${match[2]}) ${match[3]}-${match[4]}`;
                    }
                    break;
                // Add other country formats as needed
            }
            return phone;
        } catch (error) {
            logger.error('Phone formatting error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                phone,
                country
            });
            return phone;
        }
    };

    /**
     * Number Formatting
     */
    formatNumber = (num: number, options: Intl.NumberFormatOptions = {}): string => {
        try {
            return new Intl.NumberFormat(this.defaultLocale, options).format(num);
        } catch (error) {
            logger.error('Number formatting error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                number: num
            });
            return String(num);
        }
    };

    formatCurrency = (amount: number, currency = 'USD'): string => {
        return this.formatNumber(amount, {
            style: 'currency',
            currency
        });
    };

    /**
     * Conditional Helpers
     */
    ifEquals = (arg1: any, arg2: any, options: any): string => {
        return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    };

    ifNotEquals = (arg1: any, arg2: any, options: any): string => {
        return arg1 !== arg2 ? options.fn(this) : options.inverse(this);
    };

    includes = (array: any[], item: any): boolean => {
        return Array.isArray(array) && array.includes(item);
    };

    /**
     * URL Helpers
     */
    formatUrl = (url: string, params: Record<string, string> = {}): string => {
        try {
            const urlObject = new URL(url);
            Object.entries(params).forEach(([key, value]) => {
                urlObject.searchParams.append(key, value);
            });
            return urlObject.toString();
        } catch (error) {
            logger.error('URL formatting error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                url,
                params
            });
            return url;
        }
    };

    /**
     * Template-specific Helpers
     */
    getSalutation = (hour?: number): string => {
        const currentHour = hour ?? new Date().getHours();
        if (currentHour < 12) return 'Good morning';
        if (currentHour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    formatMessagePreview = (message: string, maxLength = 50): string => {
        return this.truncate(message, maxLength);
    };
}

// Create and export a default instance
export const templateHelpers = new TemplateHelpers();

// Export the class for custom instances
export default TemplateHelpers;