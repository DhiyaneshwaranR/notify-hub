import { Request, Response, NextFunction } from 'express';
import { JWTManager } from '../security/auth/jwt.auth';
import { RBACManager } from '../security/access-control/rbac';
import { AuditLogger } from '../security/audit/audit-logger';
import { ApiError } from './error.middleware';

export const securityMiddleware = {
    validateJWT: (jwtManager: JWTManager) => async (
        req: Request,
        // @ts-ignore
        res: Response,
        next: NextFunction
    ) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                throw new ApiError(401, 'No token provided');
            }

            const decoded = await jwtManager.verifyToken(token);
            req.user = decoded;
            next();
        } catch (error) {
            next(new ApiError(401, 'Invalid or expired token'));
        }
    },

    checkPermission: (rbacManager: RBACManager) => (
        req: Request,
        // @ts-ignore
        res: Response,
        next: NextFunction
    ) => {
        try {
            // Skip RBAC for public routes
            if (req.path.includes('/auth/') || req.method === 'OPTIONS') {
                return next();
            }

            if (!req.user?.role) {
                throw new ApiError(401, 'Authentication required');
            }

            // Map the route to required permission
            const permission = mapRouteToPermission(req.path);
            if (permission && !rbacManager.hasPermission(req.user.role, permission)) {
                throw new ApiError(403, 'Insufficient permissions');
            }

            next();
        } catch (error) {
            next(error);
        }
    },

    auditLog: (auditLogger: AuditLogger) => async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        const originalSend = res.send;
        res.send = function (body) {
            res.send = originalSend;
            auditLogger.log({
                userId: req.user?.id || 'anonymous',
                action: req.method,
                resource: req.path,
                resourceId: req.params.id,
                details: {
                    query: req.query,
                    body: req.body,
                    statusCode: res.statusCode
                },
                ipAddress: req.ip || "",
                userAgent: req.headers['user-agent'] || 'unknown',
                timestamp: new Date()
            }).catch(console.error);
            return originalSend.call(this, body);
        };
        next();
    }
};

function mapRouteToPermission(path: string): string | null {
    // Define your route to permission mapping
    const routePermissions: Record<string, string> = {
        '/api/v1/notifications': 'notification:create',
        '/api/v1/users': 'user:read',
        // Add more mappings as needed
    };

    // Find matching route permission
    return Object.entries(routePermissions)
        .find(([route]) => path.startsWith(route))?.[1] || null;
}