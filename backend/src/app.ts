import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import router from './routes';
import { errorHandler } from './middleware/error.middleware';
import connectDB from './config/database';
import logger from './utils/logger';

import { setupRateLimiting } from './security/rate-limiting';
import { RateLimiter } from './security/rate-limiting/rate-limiter';
import { JWTManager } from './security/auth/jwt.auth';
import { RBACManager } from './security/access-control/rbac';
import { AuditLogger } from './security/audit/audit-logger';
import Redis from 'ioredis';
import config from './config';
import {securityMiddleware} from "./middleware/security-middleware";

const app = express();
const redis = new Redis(config.redis);

// Initialize security components
const jwtManager = new JWTManager(redis);
const rbacManager = new RBACManager();
const auditLogger = new AuditLogger(redis);

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security middleware
app.use(securityMiddleware.auditLog(auditLogger));

// Apply JWT validation and API key validation to all /api routes except auth
app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
    if (req.path.includes('/auth/login') ||
        req.path.includes('/auth/register') ||
        req.method === 'OPTIONS') {
        return next();
    }

    // Use the existing security middleware
    securityMiddleware.validateJWT(jwtManager)(req, _res, next);
});

// Apply RBAC after authentication
app.use('/api', securityMiddleware.checkPermission(rbacManager));

// Apply global rate limiting
app.use('/api', RateLimiter.createApiLimiter(redis));


connectDB();

// Setup API routes with additional rate limiting
setupRateLimiting(router);
app.use('/api/v1', router);

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Application error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        user: req.user?.id
    });
    errorHandler(err, req, res, next);
});

export default app;