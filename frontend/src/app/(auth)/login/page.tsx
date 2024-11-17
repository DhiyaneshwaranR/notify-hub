'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
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
import {useToast} from "@/hooks/use-toast";

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const { login } = useAuth()
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await login(email, password)
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Invalid email or password'
            })
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
                        />
                    </div>
                    <Button type="submit" className="w-full">
                        Sign in
                    </Button>
                    <div className="text-center text-sm">
                        Don't have an account?{' '}
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