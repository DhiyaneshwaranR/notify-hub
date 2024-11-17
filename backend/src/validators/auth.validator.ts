import { body } from 'express-validator';

export const registerValidator = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required'),
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
];

export const loginValidator = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

export const apiKeyValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('API key name is required')
        .isLength({ max: 50 })
        .withMessage('API key name cannot exceed 50 characters')
];