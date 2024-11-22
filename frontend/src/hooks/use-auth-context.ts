import { createContext, useContext } from 'react'
import { User } from '@/lib/auth'

interface AuthContextType {
    user: User | null
    loading: boolean
    isAuthenticated: boolean
    checkAuth: () => Promise<User|null|undefined>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuthContext() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider')
    }
    return context
}