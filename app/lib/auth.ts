/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/22
 *
 * Server-side authentication helpers for Server Components.
 *
 * - fetchMe           — get current user, null if unauthenticated
 * - requireAuth       — get current user, redirect to /login if unauthenticated
 * - processAppCallback — exchange OAuth2 code for session (mobile app login)
 *
 * C3 fix: fetchMe now distinguishes 401 (unauthenticated) from 5xx
 * (server error). 5xx errors are thrown so Next.js error boundary
 * handles them instead of silently redirecting to /login.
 *
 * M5 fix: processAppCallback returns error details so the callback
 * page can communicate the failure reason to the user.
 */
import { redirect } from 'next/navigation';

import type { MeResponse } from '@/services/sso/api';
import { forwardSetCookies, serverFetch } from '@/services/server-fetch';

/**
 * Fetch current user info. Returns null if not authenticated (401).
 * Throws on server errors (5xx) or network failures so the error
 * boundary handles them instead of silently treating the user as
 * unauthenticated.
 */
export const fetchMe = async (): Promise<MeResponse | null> => {
	const { response, data } = await serverFetch<MeResponse>('/web/auth/me');
	if (response.status === 401 || response.status === 403) return null;
	if (!response.ok) throw new Error(`fetchMe failed: ${response.status}`);
	return data;
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

	// Use relative path so safeRedirect works on any domain (localhost, staging, etc.)
	redirect(`/login?from=${encodeURIComponent(currentPath)}`);
};

/**
 * Result of processing an app callback (mobile app login).
 * M5 fix: returns error details so the callback page can communicate
 * the failure reason to the user.
 */
export interface AppCallbackResult {
	ok: boolean;
	reason?: string;
}

/**
 * Process an app callback (exchange code for session) in SSR.
 * Forwards Set-Cookie headers from the backend to the browser.
 * Returns result with ok=true on success, or ok=false with reason on failure.
 */
export const processAppCallback = async (
	code: string
): Promise<AppCallbackResult> => {
	try {
		const { response, errorEnvelope } = await serverFetch(
			'/web/auth/app-callback',
			{
				method: 'POST',
				body: JSON.stringify({ code }),
			}
		);

		if (!response.ok) {
			const reason = errorEnvelope.message || `HTTP ${response.status}`;
			return { ok: false, reason };
		}

		await forwardSetCookies(response);
		return { ok: true };
	} catch (e) {
		return {
			ok: false,
			reason: e instanceof Error ? e.message : 'Network error',
		};
	}
};
