export default function AuthLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-100">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="text-center text-3xl font-bold tracking-tight">
                    Notify Hub
                </h2>
            </div>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                {children}
            </div>
        </div>
    )
}