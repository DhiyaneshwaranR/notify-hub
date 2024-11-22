export const API_CONFIG = {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    apiVersion: '/api/v1',
    endpoints: {
        auth: {
            login: '/auth/login',
            register: '/auth/register',
            refreshToken: '/auth/refresh-token',
            profile: '/auth/me',
        },
        notifications: {
            list: '/notifications',
            create: '/notifications',
            get: (id: string) => `/notifications/${id}`,
        },
        // Add other endpoints as needed
    }
} as const;

// Helper function to create full API URLs
export function createApiUrl(path: string): string {
    return `${API_CONFIG.baseUrl}${API_CONFIG.apiVersion}${path}`;
}