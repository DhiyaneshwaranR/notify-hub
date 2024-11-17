'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: 'admin' | 'user'
}

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => void
    isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Check if user is logged in
        checkAuth()
    }, [])

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('token')
            if (token) {
                // Verify token with backend
                const response = await fetch('/api/auth/verify', {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                if (response.ok) {
                    const userData = await response.json()
                    setUser(userData)
                } else {
                    localStorage.removeItem('token')
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error)
        } finally {
            setLoading(false)
        }
    }

    const login = async (email: string, password: string) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            if (!response.ok) {
                throw new Error('Login failed')
            }

            const data = await response.json()
            localStorage.setItem('token', data.token)
            setUser(data.user)
            router.push('/dashboard')
        } catch (error) {
            console.error('Login error:', error)
            throw error
        }
    }

    const logout = () => {
        localStorage.removeItem('token')
        setUser(null)
        router.push('/login')
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                isAuthenticated: !!user
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}