import { body } from 'express-validator';
import { NotificationChannel, NotificationPriority } from '../types/notification';

export const createNotificationValidators = [
    body('channel')
        .isIn(Object.values(NotificationChannel))
        .withMessage('Invalid notification channel'),

    body('recipients')
        .isArray()
        .withMessage('Recipients must be an array')
        .notEmpty()
        .withMessage('Recipients cannot be empty'),

    body('recipients.*.id')
        .exists()
        .withMessage('Recipient ID is required'),

    body('recipients.*.channel')
        .isIn(Object.values(NotificationChannel))
        .withMessage('Invalid recipient channel'),

    body('recipients.*.destination')
        .exists()
        .withMessage('Recipient destination is required'),

    body('content.body')
        .exists()
        .withMessage('Notification body is required'),

    body('priority')
        .isIn(Object.values(NotificationPriority))
        .withMessage('Invalid priority level'),
];