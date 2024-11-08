import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

export const errorHandler = (
    error: Error | ApiError,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
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