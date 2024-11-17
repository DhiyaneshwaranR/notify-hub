'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {useToast} from "@/hooks/use-toast";

const settingsFormSchema = z.object({
    displayName: z.string().min(2, {
        message: "Display name must be at least 2 characters.",
    }),
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
    emailNotifications: z.boolean().default(true),
    smsNotifications: z.boolean().default(false),
    timeZone: z.string(),
    language: z.string(),
})

type SettingsFormValues = z.infer<typeof settingsFormSchema>

const defaultValues: Partial<SettingsFormValues> = {
    displayName: "",
    email: "",
    emailNotifications: true,
    smsNotifications: false,
    timeZone: "UTC",
    language: "en",
}

export function SettingsForm() {
    const { toast } = useToast()
    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues,
    })

    function onSubmit(data: SettingsFormValues) {
        toast({
            title: "Settings updated",
            description: "Your settings have been updated successfully.",
        })
        console.log(data)
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-8">
                    {/* Profile Section */}
                    <div>
                        <h3 className="text-lg font-medium">Profile</h3>
                        <p className="text-sm text-muted-foreground">
                            Update your personal information.
                        </p>
                    </div>
                    <Separator />
                    <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Display Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Enter your name" {...field} />
                                </FormControl>
                                <FormDescription>
                                    This is the name that will be displayed to other users.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input placeholder="Enter your email" {...field} />
                                </FormControl>
                                <FormDescription>
                                    This email will be used for notifications and account recovery.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Notification Settings */}
                    <div>
                        <h3 className="text-lg font-medium">Notifications</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure how you receive notifications.
                        </p>
                    </div>
                    <Separator />
                    <FormField
                        control={form.control}
                        name="emailNotifications"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                                <div className="space-y-0.5">
                                    <FormLabel>Email Notifications</FormLabel>
                                    <FormDescription>
                                        Receive notifications via email.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="smsNotifications"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                                <div className="space-y-0.5">
                                    <FormLabel>SMS Notifications</FormLabel>
                                    <FormDescription>
                                        Receive notifications via SMS.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {/* Preferences */}
                    <div>
                        <h3 className="text-lg font-medium">Preferences</h3>
                        <p className="text-sm text-muted-foreground">
                            Customize your account preferences.
                        </p>
                    </div>
                    <Separator />
                    <FormField
                        control={form.control}
                        name="language"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Language</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a language" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="es">Spanish</SelectItem>
                                        <SelectItem value="fr">French</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    Choose your preferred language.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="timeZone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Time Zone</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a timezone" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="UTC">UTC</SelectItem>
                                        <SelectItem value="EST">Eastern Time</SelectItem>
                                        <SelectItem value="PST">Pacific Time</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    Choose your timezone for accurate notifications.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button type="submit">Save changes</Button>
            </form>
        </Form>
    )
}