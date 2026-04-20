/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/2/8 14:07
 */
import { NextRequest, NextResponse } from 'next/server';

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
		 */
		'/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
	],
};

// Paths that must be accessible to anonymous visitors. The SSO consent page is
// explicitly allow-listed because it hosts its own login surface (QR + passkey)
// and needs to preserve the original OAuth query parameters across the login
// step — redirecting to /login would drop client_id / redirect_uri / state.
const PUBLIC_PATHS = ['/login', '/sso-authorize'];

export const middleware = (request: NextRequest) => {
	const { pathname } = request.nextUrl;
	if (
		PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
	) {
		return NextResponse.next();
	}
	if (request.cookies.has('token')) {
		return NextResponse.next();
	}
	return NextResponse.redirect(new URL('/login', request.url));
};
