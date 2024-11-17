'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Bell,
    Settings,
    Users,
    Key,
    BarChart,
    FileText,
} from "lucide-react"

const routes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
    },
    {
        label: "Notifications",
        icon: Bell,
        href: "/notifications",
    },
    {
        label: "Templates",
        icon: FileText,
        href: "/templates",
    },
    {
        label: "Analytics",
        icon: BarChart,
        href: "/analytics",
    },
    {
        label: "API Keys",
        icon: Key,
        href: "/api-keys",
    },
    {
        label: "Team",
        icon: Users,
        href: "/team",
    },
    {
        label: "Settings",
        icon: Settings,
        href: "/settings",
    },
]

export function SideNav() {
    const pathname = usePathname()

    return (
        <div className="flex h-full flex-col py-4">
            <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-lg font-semibold text-white">
                    Notify Hub
                </h2>
            </div>
            <div className="flex-1 px-3">
                {routes.map((route) => (
                    <Link
                        key={route.href}
                        href={route.href}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-800 hover:text-white",
                            pathname === route.href ? "bg-slate-800 text-white" : "text-slate-400"
                        )}
                    >
                        <route.icon className="h-4 w-4" />
                        {route.label}
                    </Link>
                ))}
            </div>
        </div>
    )
}