import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value
    const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/register')

    // Allow RSC requests to pass through if they have the token
    const isRSCRequest = request.headers.get('rsc') === '1'
    if (isRSCRequest && token) {
        return NextResponse.next()
    }

    // Handle normal page requests
    if (!token && !isAuthPage) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * 1. /api/ routes
         * 2. /_next/ (Next.js internals)
         * 3. /static (public files)
         * 4. /favicon.ico, /robots.txt, etc.
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ]
}