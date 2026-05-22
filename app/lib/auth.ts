/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Server-side authentication helpers for Server Components.
 *
 * - fetchMe           — get current user, null if unauthenticated
 * - requireAuth       — get current user, redirect to /login if unauthenticated
 * - processAppCallback — exchange OAuth2 code for session (mobile app login)
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import type { MeResponse } from '@/services/sso/api';
import { forwardSetCookies, serverFetch } from '@/services/server-fetch';

/**
 * Fetch current user info. Returns null if not authenticated.
 */
export const fetchMe = async (): Promise<MeResponse | null> => {
	try {
		const res = await serverFetch('/web/auth/me');
		if (res.status === 401) return null;
		if (!res.ok) return null;
		return (await res.json()) as MeResponse;
	} catch {
		return null;
	}
};

/**
 * Require authentication in a Server Component.
 * Returns the current user; if unauthenticated, redirects to /login
 * with the given path as the `from` parameter.
 *
 * @param currentPath The current page path (e.g. '/console', '/console/tokens').
 *                    Used to construct the redirect-back URL after login.
 *
 * Usage:
 *   const me = await requireAuth('/console');
 *   // me is guaranteed to be MeResponse (not null)
 */
export const requireAuth = async (currentPath: string): Promise<MeResponse> => {
	const me = await fetchMe();
	if (me) return me;

	const headersList = await headers();
	const host = headersList.get('host') || 'localhost:3000';
	const protocol = headersList.get('x-forwarded-proto') || 'https';
	const from = `${protocol}://${host}${currentPath}`;
	redirect(`/login?from=${encodeURIComponent(from)}`);
};

/**
 * Process an app callback (exchange code for session) in SSR.
 * Forwards Set-Cookie headers from the backend to the browser.
 * Returns true if the callback was processed successfully.
 */
export const processAppCallback = async (code: string): Promise<boolean> => {
	try {
		const res = await serverFetch('/api/auth/app-callback', {
			method: 'POST',
			body: JSON.stringify({ code }),
		});

		if (!res.ok) return false;

		await forwardSetCookies(res);
		return true;
	} catch {
		return false;
	}
};
