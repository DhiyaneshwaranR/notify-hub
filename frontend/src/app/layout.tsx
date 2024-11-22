import '../../src/app/globals.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/components/providers/auth-provider'
import {AuthLoadingProvider} from "@/components/providers/auth-loading-providers";

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <AuthProvider>
                <AuthLoadingProvider>
                    {children}
                </AuthLoadingProvider>
            </AuthProvider>
            <Toaster />
        </ThemeProvider>
        </body>
        </html>
    )
}