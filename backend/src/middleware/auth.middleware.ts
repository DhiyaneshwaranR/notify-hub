import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import User from '../models/user.model';
import config from '../config';
import { ApiError } from './error.middleware';

declare global {
    namespace Express {
        interface Request {
            user?: any;
            token?: string;
        }
    }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token: string | undefined;

        // Check for JWT token in headers
        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        // Check for API key
        else if (req.headers['x-api-key']) {
            return await validateApiKey(req, res, next);
        }

        if (!token) {
            throw new ApiError(401, 'Not authenticated. Please log in.');
        }

        // Verify token
        const decoded = await promisify<string, string>(jwt.verify)(token, config.jwt.secret);

        // Check if user exists
        // @ts-ignore
        const user = await User.findById(decoded.sub);
        if (!user || user.status !== 'active') {
            throw new ApiError(401, 'User no longer exists or is inactive');
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            next(new ApiError(401, 'Invalid token. Please log in again.'));
        } else {
            next(error);
        }
    }
};

const validateApiKey = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const apiKey = req.headers['x-api-key'] as string;

        const user = await User.findOne({
            'apiKeys.key': apiKey,
            status: 'active'
        });

        if (!user) {
            throw new ApiError(401, 'Invalid API key');
        }

        // Update last used timestamp
        const keyIndex = user.apiKeys.findIndex(k => k.key === apiKey);
        if (keyIndex !== -1) {
            user.apiKeys[keyIndex].lastUsed = new Date();
            await user.save();
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

export const restrictTo = (...roles: string[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!roles.includes(req.user.role)) {
            return next(new ApiError(403, 'You do not have permission to perform this action'));
        }
        next();
    };
};