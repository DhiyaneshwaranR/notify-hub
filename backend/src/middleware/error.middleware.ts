import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../types/errors';

export class ApiError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

export const errorHandler = (
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): Response => {
    if (error instanceof NotFoundError) {
        return res.status(404).json({
            status: 'error',
            message: error.message
        });
    }

    if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
            status: 'error',
            message: error.message
        });
    }

    console.error('Unexpected error:', error);
    return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });
};