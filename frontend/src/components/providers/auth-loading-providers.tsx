'use client'
import { LoadingSpinner } from '../ui/loading-spinner'
import {useAuthContext} from "@/hooks/use-auth-context";

export function AuthLoadingProvider({ children }: { children: React.ReactNode }) {
    const { loading } = useAuthContext()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner className="mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    return children
}