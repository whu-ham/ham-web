import { FROM_COOKIE, STATE_COOKIE } from './cookies';

export const APP_CALLBACK_BACKEND_PATH = '/web/auth/app-callback';

export const LOGIN_CALLBACK_COOKIES = {
	from: FROM_COOKIE,
	state: STATE_COOKIE,
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
