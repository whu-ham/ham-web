/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Server-side fetch infrastructure for Server Components.
 * Forwards browser cookies to the backend and handles Set-Cookie forwarding.
 */
import { cookies } from 'next/headers';

import { LOCALE_COOKIE } from '@/i18n/config';

const BACKEND_ORIGIN = process.env.HAM_BACKEND_ORIGIN ?? '';

/**
 * Parse a Set-Cookie header value into name, value, and options.
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
			case 'expires':
				options.expires = new Date(val);
				break;
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
 */
export const serverFetch = async (
	path: string,
	init?: RequestInit
): Promise<Response> => {
	const cookieStore = await cookies();
	const locale = cookieStore.get(LOCALE_COOKIE)?.value;
	const allCookies = cookieStore
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join('; ');

	return fetch(`${BACKEND_ORIGIN}${path}`, {
		...init,
		headers: {
			...(init?.body ? { 'Content-Type': 'application/json' } : {}),
			...(locale ? { 'Accept-Language': locale } : {}),
			Cookie: allCookies,
			...(init?.headers ?? {}),
		},
	});
};
