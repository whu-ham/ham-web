/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/22
 *
 * Server-side fetch infrastructure for Server Components.
 * Forwards browser cookies to the backend and handles Set-Cookie forwarding.
 *
 * M2 fix: Only forwards auth-related cookies to the backend,
 * avoiding unnecessary exposure of frontend-only cookies.
 *
 * C2 fix: Empty Cookie header is no longer sent when no relevant
 * cookies exist, avoiding misleading the backend.
 *
 * M6 fix: Validates HAM_BACKEND_ORIGIN at module load time to
 * prevent silent failures from misconfigured deployments.
 *
 * m6 fix: parseSetCookieHeader now validates Date objects from
 * the expires attribute before including them in options.
 */
import { cookies } from 'next/headers';

import {
	SESSION_COOKIE,
	REFRESH_COOKIE,
	LOCALE_COOKIE,
	THEME_COOKIE,
} from '@/services/cookies';

const BACKEND_ORIGIN = process.env.HAM_BACKEND_ORIGIN ?? '';

/**
 * Cookie names that are relevant to the backend.
 * Only these will be forwarded in the Cookie header.
 * All other cookies (theme, locale UI pref, analytics, etc.) are stripped.
 */
const FORWARDABLE_COOKIES = new Set([
	SESSION_COOKIE,
	REFRESH_COOKIE,
	LOCALE_COOKIE,
	THEME_COOKIE,
]);

/**
 * Parse a Set-Cookie header value into name, value, and options.
 * m6 fix: validates Date objects from the expires attribute.
 */
const parseSetCookieHeader = (header: string) => {
	const [nameValue, ...attrs] = header.split(';');
	const eqIdx = nameValue.indexOf('=');
	if (eqIdx === -1) return null;
	const name = nameValue.slice(0, eqIdx).trim();
	const value = nameValue.slice(eqIdx + 1).trim();

	const options: Record<string, unknown> = {};
	for (const attr of attrs) {
		const eqPos = attr.indexOf('=');
		const key = (eqPos === -1 ? attr : attr.slice(0, eqPos))
			.trim()
			.toLowerCase();
		const val = eqPos === -1 ? '' : attr.slice(eqPos + 1).trim();
		switch (key) {
			case 'path':
				options.path = val;
				break;
			case 'domain':
				options.domain = val;
				break;
			case 'max-age':
				options.maxAge = Number(val);
				break;
			case 'expires': {
				const d = new Date(val);
				if (!Number.isNaN(d.getTime())) options.expires = d;
				break;
			}
			case 'secure':
				options.secure = true;
				break;
			case 'httponly':
				options.httpOnly = true;
				break;
			case 'samesite':
				options.sameSite = val.toLowerCase();
				break;
		}
	}

	return { name, value, options };
};

/**
 * Forward Set-Cookie headers from a backend response to the browser response.
 */
export const forwardSetCookies = async (res: Response) => {
	const cookieStore = await cookies();
	const setCookies = res.headers.getSetCookie?.() ?? [];
	if (setCookies.length === 0) {
		if (typeof res.headers.getSetCookie !== 'function') {
			console.warn(
				'[server-fetch] getSetCookie() is not supported by this runtime. ' +
					'Set-Cookie headers will be lost — login may fail silently.'
			);
		}
	}
	for (const sc of setCookies) {
		const parsed = parseSetCookieHeader(sc);
		if (parsed) {
			cookieStore.set(
				parsed.name,
				parsed.value,
				parsed.options as Record<string, unknown>
			);
		}
	}
};

/**
 * Make a server-side fetch to the backend, forwarding browser cookies.
 * Only auth-related cookies are forwarded to minimize information exposure.
 *
 * C2 fix: Cookie header is only included when relevant cookies exist,
 * avoiding sending an empty `Cookie: ` header that could mislead the backend.
 */
export const serverFetch = async (
	path: string,
	init?: RequestInit
): Promise<Response> => {
	const cookieStore = await cookies();
	const locale = cookieStore.get(LOCALE_COOKIE)?.value;
	// M2: Only forward whitelisted cookies
	const relevantCookies = cookieStore
		.getAll()
		.filter((c) => FORWARDABLE_COOKIES.has(c.name))
		.map((c) => `${c.name}=${c.value}`)
		.join('; ');

	// C2: Only include Cookie header when there are relevant cookies
	const headers: Record<string, string> = {
		...(init?.body ? { 'Content-Type': 'application/json' } : {}),
		...(locale ? { 'Accept-Language': locale } : {}),
		...((init?.headers as Record<string, string>) ?? {}),
	};
	if (relevantCookies) {
		headers.Cookie = relevantCookies;
	}

	return fetch(`${BACKEND_ORIGIN}${path}`, {
		...init,
		headers,
	});
};
