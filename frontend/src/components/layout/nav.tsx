'use client'

import { Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserNav } from "./user-nav"
import {ModeToggle} from "@/components/layout/mode-toggle";


export function Nav() {
    return (
        <header className="border-b">
            <div className="flex h-16 items-center gap-4 px-4">
                <div className="md:hidden">
                    <Button variant="ghost" size="icon">
                        <Menu className="h-5 w-5" />
                    </Button>
                </div>
                <div className="ml-auto flex items-center gap-4">
                    <Button variant="ghost" size="icon">
                        <Bell className="h-5 w-5" />
                    </Button>
                    <ModeToggle />
                    <UserNav />
                </div>
            </div>
        </header>
    )
}