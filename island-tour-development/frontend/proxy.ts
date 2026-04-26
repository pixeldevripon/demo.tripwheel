import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
    // Explicit check to prevent infinite redirect loops if matcher fails
    if (!request.nextUrl.pathname.startsWith('/dashboard')) {
        return NextResponse.next();
    }

    const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

    try {
        const response = await fetch(`${backendUrl}/api/auth/get-session`, {
            headers: {
                cookie: request.headers.get('cookie') || '',
            },
        });

        const sessionData = await response.json();

        if (!sessionData || !sessionData.session) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        return NextResponse.next();
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

export const config = {
    matcher: ['/dashboard/:path*'],
};

