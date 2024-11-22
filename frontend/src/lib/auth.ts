import { API_CONFIG, createApiUrl } from './config';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'user';
}

export interface AuthResponse {
    status: string;
    data: {
        user: User;
        token: string;
        refreshToken: string;
    };
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials extends LoginCredentials {
    firstName: string;
    lastName: string;
}

class AuthService {
    private static instance: AuthService;

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    // Token management
    private setTokens(token: string, refreshToken: string) {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);

        // Set cookies with httpOnly and secure flags
        document.cookie = `token=${token}; path=/; samesite=strict; ${process.env.NODE_ENV === 'production' ? 'secure;' : ''}`;
        document.cookie = `refreshToken=${refreshToken}; path=/; samesite=strict; ${process.env.NODE_ENV === 'production' ? 'secure;' : ''}`;

    }

    private clearTokens() {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');

        // Clear cookies
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }

    public getToken(): string | null {
        return localStorage.getItem('token');
    }

    public getRefreshToken(): string | null {
        return localStorage.getItem('refreshToken');
    }

    async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        const response = await fetch(createApiUrl(API_CONFIG.endpoints.auth.register), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
        }

        const data = await response.json();
        this.setTokens(data.data.token, data.data.refreshToken);
        return data;
    }

    async logout(): Promise<void> {
        this.clearTokens();
    }

    async refreshToken(refreshToken: string): Promise<AuthResponse> {
        const response = await fetch(createApiUrl(API_CONFIG.endpoints.auth.refreshToken), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
            throw new Error('Token refresh failed');
        }

        const data = await response.json();
        this.setTokens(data.data.token, data.data.refreshToken);
        return data;
    }

    async getProfile(): Promise<User> {
        const token = this.getToken();
        if (!token) {
            throw new Error('No token found');
        }

        const response = await fetch(createApiUrl(API_CONFIG.endpoints.auth.profile), {
            headers: {
                'Authorization': `Bearer ${token}`,
                // Prevent caching
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            // Force refresh
            cache: 'no-store'
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                this.clearTokens();
                throw new Error('Authentication required');
            }
            throw new Error('Failed to fetch profile');
        }

        const { data } = await response.json();

        // Store or update token if provided in response
        if (data.token) {
            this.setTokens(data.token, data.refreshToken || this.getRefreshToken() || '');
        }

        return data.user;
    }

    // Update login to properly store tokens
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await fetch(createApiUrl(API_CONFIG.endpoints.auth.login), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }

        const data = await response.json();

        // Ensure we have tokens
        if (!data.data.token) {
            throw new Error('No token received from server');
        }

        // Store tokens
        this.setTokens(data.data.token, data.data.refreshToken);

        return data;
    }
}

export const authService = AuthService.getInstance();

// API request interceptor with token handling
export async function fetchWithAuth(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = authService.getToken();

    const finalOptions: RequestInit = {
        ...options,
        headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
    };

    try {
        const response = await fetch(createApiUrl(path), finalOptions);

        // Handle 401 Unauthorized
        if (response.status === 401) {
            const refreshToken = authService.getRefreshToken();
            if (refreshToken) {
                try {
                    await authService.refreshToken(refreshToken);
                    // Retry original request with new token
                    const newToken = authService.getToken();
                    if (newToken) {
                        finalOptions.headers = {
                            ...finalOptions.headers,
                            'Authorization': `Bearer ${newToken}`,
                        };
                        return fetch(createApiUrl(path), finalOptions);
                    }
                } catch (error) {
                    await authService.logout();
                    window.location.href = '/login';
                    throw error;
                }
            } else {
                await authService.logout();
                window.location.href = '/login';
            }
        }

        return response;
    } catch (error) {
        throw error;
    }
}