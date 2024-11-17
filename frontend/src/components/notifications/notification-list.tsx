'use client'

import { useState } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from 'date-fns'

type NotificationStatus = 'sent' | 'delivered' | 'failed' | 'pending'

interface Notification {
    id: string
    title: string
    type: 'email' | 'sms' | 'push'
    status: NotificationStatus
    recipient: string
    createdAt: Date
}

// Mock data - replace with real API call
const mockNotifications: Notification[] = [
    {
        id: '1',
        title: 'Welcome Email',
        type: 'email',
        status: 'delivered',
        recipient: 'john@example.com',
        createdAt: new Date('2024-01-15T10:00:00'),
    },
    {
        id: '2',
        title: 'Password Reset',
        type: 'email',
        status: 'sent',
        recipient: 'jane@example.com',
        createdAt: new Date('2024-01-15T09:30:00'),
    },
    {
        id: '3',
        title: 'Order Confirmation',
        type: 'sms',
        status: 'delivered',
        recipient: '+1234567890',
        createdAt: new Date('2024-01-15T09:00:00'),
    },
    {
        id: '4',
        title: 'Account Update',
        type: 'push',
        status: 'failed',
        recipient: 'user-device-token',
        createdAt: new Date('2024-01-15T08:30:00'),
    },
]

function NotificationTypeIcon({ type }: { type: 'email' | 'sms' | 'push' }) {
    // const iconClasses = "h-4 w-4"
    return (
        <span className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
      {/* You can replace these with actual icons */}
            {type === 'email' ? '📧' : type === 'sms' ? '💬' : '🔔'}
    </span>
    )
}

function StatusBadge({ status }: { status: NotificationStatus }) {
    const variants: Record<NotificationStatus, { color: string, label: string }> = {
        sent: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', label: 'Sent' },
        delivered: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', label: 'Delivered' },
        failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Failed' },
        pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', label: 'Pending' }
    }

    return (
        <Badge variant="secondary" className={variants[status].color}>
            {variants[status].label}
        </Badge>
    )
}

export function NotificationList() {
    const [notifications] = useState<Notification[]>(mockNotifications)

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {notifications.map((notification) => (
                        <TableRow key={notification.id}>
                            <TableCell>
                                <NotificationTypeIcon type={notification.type} />
                            </TableCell>
                            <TableCell className="font-medium">{notification.title}</TableCell>
                            <TableCell>{notification.recipient}</TableCell>
                            <TableCell>
                                <StatusBadge status={notification.status} />
                            </TableCell>
                            <TableCell>
                                {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                                <Button variant="ghost" size="sm">
                                    View
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}