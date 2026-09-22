/**
 * @author Claude
 * @version 2.0
 * @date 2026/9/23 01:41:09
 *
 * Server-side authentication helpers for Server Components.
 *
 * - fetchMe     — get current user, null if unauthenticated
 * - requireAuth — get current user, redirect to /login if unauthenticated
 *
 * C3 fix: fetchMe now distinguishes 401 (unauthenticated) from 5xx
 * (server error). 5xx errors are thrown so Next.js error boundary
 * handles them instead of silently redirecting to /login.
 *
 * FetchMe treats a 200 that carries no JSON as an error. The
 * defensive body parsing in serverFetch turns an HTML gateway page into
 * `null`, and returning `null` from here sends a signed-in visitor to
 * /login.
 */
import { redirect } from 'next/navigation';

import type { MeResponse } from '@/services/sso/api';
import { serverFetch } from '@/services/server-fetch';

/**
 * Fetch current user info. Returns null if not authenticated (401).
 * Throws on server errors (5xx) or network failures so the error
 * boundary handles them instead of silently treating the user as
 * unauthenticated.
 */
export const fetchMe = async (): Promise<MeResponse | null> => {
	const { response, data, bodyIsJson } =
		await serverFetch<MeResponse>('/web/auth/me');
	if (response.status === 401 || response.status === 403) return null;
	if (!response.ok) throw new Error(`fetchMe failed: ${response.status}`);
	// A signed-in user must never be redirected to /login because the
	// backend answered with something that is not JSON.
	if (!bodyIsJson) throw new Error('fetchMe failed: non-JSON response');
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
