import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { authService, LoginCredentials, RegisterCredentials } from '@/lib/auth';

export function useAuthService() {
    const router = useRouter();
    const { toast } = useToast();

    async function login(credentials: LoginCredentials) {
        try {
            const response = await authService.login(credentials);
            toast({
                title: 'Welcome back!',
                description: 'Login successful',
            });
            return response.data;
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: error instanceof Error ? error.message : 'An error occurred',
            });
            throw error;
        }
    }

    async function register(credentials: RegisterCredentials) {
        try {
            const response = await authService.register(credentials);
            toast({
                title: 'Welcome!',
                description: 'Registration successful',
            });
            return response.data;
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Registration Failed',
                description: error instanceof Error ? error.message : 'An error occurred',
            });
            throw error;
        }
    }

    async function logout() {
        try {
            await authService.logout();
            router.push('/login');
            toast({
                title: 'Goodbye!',
                description: 'You have been logged out',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Logout Failed',
                description: error instanceof Error ? error.message : 'An error occurred',
            });
        }
    }

    return {
        login,
        register,
        logout,
    };
}