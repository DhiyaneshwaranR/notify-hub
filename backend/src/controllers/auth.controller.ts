import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/user.model';
import { asyncHandler } from '../middleware/async.middleware';
import { ApiError } from '../middleware/error.middleware';
import { generateToken, generateRefreshToken } from '../utils/jwt.utils';
import logger from '../utils/logger';
import jwt from "jsonwebtoken";
import config from '../config';

class AuthController {
    /**
     * User Registration
     * POST /api/v1/auth/register
     */
    register = asyncHandler(async (req: Request, res: Response) => {
        const { email, password, firstName, lastName } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new ApiError(400, 'Email already registered');
        }

        // Create user
        const user = await User.create({
            email,
            password,
            firstName,
            lastName
        });

        // Generate tokens
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.status(201).json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
                },
                token,
                refreshToken
            }
        });
    });

    /**
     * User Login
     * POST /api/v1/auth/login
     */
    login = asyncHandler(async (req: Request, res: Response) => {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            throw new ApiError(401, 'Invalid email or password');
        }

        if (user.status !== 'active') {
            throw new ApiError(401, 'Your account is not active');
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate tokens
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
                },
                token,
                refreshToken
            }
        });
    });

    /**
     * Generate API Key
     * POST /api/v1/auth/api-keys
     */
    generateApiKey = asyncHandler(async (req: Request, res: Response) => {
        const { name } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const apiKey = uuidv4();
        user.apiKeys.push({
            key: apiKey,
            name,
            createdAt: new Date()
        });

        await user.save();

        logger.info('API key generated', { userId, keyName: name });

        res.status(201).json({
            status: 'success',
            data: {
                apiKey,
                name,
                createdAt: new Date()
            }
        });
    });

    /**
     * List API Keys
     * GET /api/v1/auth/api-keys
     */
    listApiKeys = asyncHandler(async (req: Request, res: Response) => {
        const user = await User.findById(req.user._id);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        res.json({
            status: 'success',
            data: user.apiKeys.map(key => ({
                name: key.name,
                createdAt: key.createdAt,
                lastUsed: key.lastUsed
            }))
        });
    });

    /**
     * Revoke API Key
     * DELETE /api/v1/auth/api-keys/:keyName
     */
    revokeApiKey = asyncHandler(async (req: Request, res: Response) => {
        const { keyName } = req.params;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        user.apiKeys = user.apiKeys.filter(key => key.name !== keyName);
        await user.save();

        logger.info('API key revoked', { userId, keyName });

        res.status(204).send();
    });

    /**
     * Refresh Token
     * POST /api/v1/auth/refresh-token
     */
    refreshToken = asyncHandler(async (req: Request, res: Response) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new ApiError(400, 'Refresh token is required');
        }

        // Verify refresh token and get user
        const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
        const user = await User.findById(decoded.sub);

        if (!user || user.status !== 'active') {
            throw new ApiError(401, 'Invalid refresh token');
        }

        // Generate new tokens
        const newToken = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);

        res.json({
            status: 'success',
            data: {
                token: newToken,
                refreshToken: newRefreshToken
            }
        });
    });

    /**
     * Get Current User Profile
     * GET /api/v1/auth/me
     */
    getProfile = asyncHandler(async (req: Request, res: Response) => {
        const user = await User.findById(req.user._id);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        res.json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    settings: user.settings,
                    lastLogin: user.lastLogin
                }
            }
        });
    });
}

export default new AuthController();