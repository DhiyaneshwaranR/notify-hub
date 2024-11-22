'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, authService } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { AuthContext } from '@/hooks/use-auth-context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()
    const { toast } = useToast()

    const checkAuth = async () => {
        const token = authService.getToken();

        if (!token) {
            setUser(null);
            setLoading(false);
            return null;
        }

        try {
            const user = await authService.getProfile();
            console.log('Profile check successful:', user); // Debug log
            setUser(user);
            return user;
        } catch (error) {
            console.error('Profile check failed:', error); // Debug log
            setUser(null);
            await authService.logout();

            if (!pathname?.includes('/login') && !pathname?.includes('/register')) {
                toast({
                    variant: 'destructive',
                    title: 'Session expired',
                    description: 'Please log in again',
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // Check auth on mount and token changes
    useEffect(() => {
        const token = authService.getToken();
        console.log('Current token:', token); // Debug log
        checkAuth();
    }, []);

    // Handle route protection
    useEffect(() => {
        if (!loading) {
            const token = authService.getToken();
            const isAuthPage = pathname === '/login' || pathname === '/register';
            console.log('Route check:', { token, isAuthPage, pathname }); // Debug log

            if (!token && !isAuthPage && pathname !== '/') {
                console.log('Redirecting to login - no token');
                router.push('/login');
            } else if (token && user && isAuthPage) {
                console.log('Redirecting to dashboard - has token and user');
                router.push('/dashboard');
            }
        }
    }, [loading, user, pathname, router]);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isAuthenticated: !!user && !!authService.getToken(),
                checkAuth
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}