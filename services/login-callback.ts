/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/18 16:56:23
 *
 * Helpers for the mobile app deep-link login callback.
 *
 * The callback reads the app-login cookie pair, which is deliberately
 * separate from the browser OAuth pair: /login renders the OAuth provider
 * links alongside the "Open App" button, so a shared cookie would let a
 * prefetched OAuth start overwrite an app login already in flight.
 */
import { APP_FROM_COOKIE, APP_STATE_COOKIE } from './cookies';

export const APP_CALLBACK_BACKEND_PATH = '/web/auth/app-callback';

export const LOGIN_CALLBACK_COOKIES = {
	from: APP_FROM_COOKIE,
	state: APP_STATE_COOKIE,
} as const;

export const parseAllowedRedirectHosts = (
	value: string | undefined
): ReadonlySet<string> =>
	new Set(
		(value ?? '')
			.split(',')
			.map((h) => h.trim().toLowerCase())
			.filter(Boolean)
	);

export const safeRedirectWithAllowedHosts = (
	from: string | null | undefined,
	allowedHosts: ReadonlySet<string>,
	fallback = '/console'
): string => {
	if (!from) return fallback;

	if (
		from.startsWith('/') &&
		!from.startsWith('//') &&
		!from.startsWith('/\\')
	) {
		try {
			const u = new URL(from, 'https://placeholder.invalid');
			if (u.host === 'placeholder.invalid') return from;
		} catch {
			// Invalid URL.
		}
	}

	try {
		const url = new URL(from);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;

		const host = url.hostname.toLowerCase();
		if (allowedHosts.size > 0) {
			for (const allowed of allowedHosts) {
				if (host === allowed || host.endsWith(`.${allowed}`)) return from;
			}
		}
	} catch {
		// Not an absolute URL.
	}

	return fallback;
};

export const readCookieFromHeader = (
	cookieHeader: string | null | undefined,
	name: string
): string | undefined => {
	const parts = (cookieHeader ?? '').split(';');
	for (const part of parts) {
		const eqIdx = part.indexOf('=');
		if (eqIdx === -1) continue;
		const key = part.slice(0, eqIdx).trim();
		if (key !== name) continue;

		const value = part.slice(eqIdx + 1).trim();
		try {
			return decodeURIComponent(value);
		} catch {
			return value;
		}
	}
	return undefined;
};

export const expireLoginCookie = (name: string): string =>
	`${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export const getBackendSetCookies = (res: Response): string[] =>
	res.headers.getSetCookie?.() ?? [];
