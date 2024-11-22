'use client'

import {useEffect, useState} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthService } from '@/hooks/use-auth-service'
import { useAuthContext } from '@/hooks/use-auth-context'
import {authService} from "@/lib/auth";

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const { login } = useAuthService()
    const { checkAuth, isAuthenticated } = useAuthContext()
    const router = useRouter()

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/dashboard')
        }
    }, [isAuthenticated, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Perform login
            const response = await login({ email, password })
            console.log('Login response:', response); // Debug log

            // Verify token storage
            const token = authService.getToken();
            if (!token) {
                throw new Error('No token stored after login');
            }

            // Update auth context
            await checkAuth();

            // Force navigation to dashboard
            router.push('/dashboard');
            router.refresh(); // Force refresh to ensure new auth state is picked up
        } catch (error) {
            console.error('Login error:', error)
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sign in to your account</CardTitle>
                <CardDescription>
                    Enter your email below to sign in to your account
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="m@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </Button>
                    <div className="text-center text-sm">
                        Don&apos;t have an account?{' '}
                        <Link
                            href="/register"
                            className="font-medium text-primary hover:underline"
                        >
                            Register
                        </Link>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}