import { SideNav } from '@/components/layout/side-nav'
import { Nav } from '@/components/layout/nav'

export default function DashboardLayout({
                                            children,
                                        }: {
    children: React.ReactNode
}) {
    return (
        <div className="relative h-screen">
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-slate-900">
                <SideNav />
            </div>
            <main className="md:pl-72">
                <Nav />
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
