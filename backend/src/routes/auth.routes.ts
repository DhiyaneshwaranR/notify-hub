import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {loginValidator, registerValidator, apiKeyValidator} from "../validators/auth.validator";
import redis from '../config/redis';
import {RateLimiter} from "../security/rate-limiting/rate-limiter";

const router = Router();

// Public routes
router.post('/register', registerValidator, validate, AuthController.register);
router.post('/login',
    RateLimiter.createAuthLimiter(redis),loginValidator, validate,
    AuthController.login
);
router.post('/refresh-token', AuthController.refreshToken);

// Protected routes
router.use(protect); // All routes below this will require authentication

router.get('/me', AuthController.getProfile);
router.post('/api-keys', apiKeyValidator, validate, AuthController.generateApiKey);
router.get('/api-keys', AuthController.listApiKeys);
router.delete('/api-keys/:keyName', AuthController.revokeApiKey);

// Admin only routes
router.use(restrictTo('admin')); // All routes below this will require admin role

export default router;