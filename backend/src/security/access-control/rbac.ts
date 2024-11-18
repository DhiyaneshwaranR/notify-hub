export enum UserRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    USER = 'user'
}
//
// interface Permission {
//     action: string;
//     resource: string;
// }

export class RBACManager {
    private rolePermissions: Map<UserRole, Set<string>>;

    constructor() {
        this.rolePermissions = new Map();
        this.initializeDefaultPermissions();
    }

    private initializeDefaultPermissions(): void {
        // Admin permissions
        this.rolePermissions.set(UserRole.ADMIN, new Set([
            'notification:create',
            'notification:read',
            'notification:update',
            'notification:delete',
            'user:create',
            'user:read',
            'user:update',
            'user:delete',
            'apikey:create',
            'apikey:read',
            'apikey:delete'
        ]));

        // Manager permissions
        this.rolePermissions.set(UserRole.MANAGER, new Set([
            'notification:create',
            'notification:read',
            'notification:update',
            'user:read',
            'apikey:create',
            'apikey:read'
        ]));

        // User permissions
        this.rolePermissions.set(UserRole.USER, new Set([
            'notification:create',
            'notification:read',
            'apikey:create',
            'apikey:read'
        ]));
    }

    hasPermission(role: UserRole, permission: string): boolean {
        const permissions = this.rolePermissions.get(role);
        return permissions ? permissions.has(permission) : false;
    }
}