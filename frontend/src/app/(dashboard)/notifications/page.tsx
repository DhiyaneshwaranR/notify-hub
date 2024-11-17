import { NotificationList } from "@/components/notifications/notification-list"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

export default function NotificationsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Notifications</h3>
                    <p className="text-sm text-muted-foreground">
                        View and manage your notification history
                    </p>
                </div>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Notification
                </Button>
            </div>
            <NotificationList />
        </div>
    )
}