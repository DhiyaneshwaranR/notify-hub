'use client'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "../ui/loading-spinner"
import { useAuthContext } from '@/hooks/use-auth-context'
import { useAuthService } from '@/hooks/use-auth-service'

export function UserNav() {
    const router = useRouter()
    const { user, loading } = useAuthContext()
    const { logout } = useAuthService()

    if (loading) {
        return <LoadingSpinner />
    }

    if (!user) {
        return null
    }

    const initials = `${user.firstName[0]}${user.lastName[0]}`

    const handleLogout = async () => {
        await logout()
        router.push('/login')
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                    Settings
                </DropdownMenuItem>
                {user.role === 'admin' && (
                    <DropdownMenuItem onClick={() => router.push('/admin')}>
                        Admin Dashboard
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={handleLogout}
                >
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}