/**
 * @author Claude
 * @version 1.4
 * @date 2026/9/23 01:31:52
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
 * M6 fix: HAM_BACKEND_ORIGIN is validated before a request is issued,
 * so a misconfigured deployment fails loudly instead of silently
 * degrading into a relative fetch.
 *
 * m6 fix: parseSetCookieHeader now validates Date objects from
 * the expires attribute before including them in options.
 *
 * r1 fix: response bodies are parsed defensively. A 204/205 reply or an
 * HTML error page has no JSON to parse, and `Response.json()` throws on
 * both — which turned a benign "no content" into a network failure.
 *
 * r6 fix: callers can tell "no body" from "empty payload". Treating a
 * non-JSON 200 as an empty result made fetchMe bounce a signed-in user
 * to /login and made the token list render "no keys" with no retry.
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
 * Absolute URL for a backend path.
 *
 * M6: an unset `HAM_BACKEND_ORIGIN` used to degrade into a relative
 * `fetch('/web/...')`, which fails deep inside undici with an opaque
 * "Failed to parse URL" and looks like a backend outage. Fail at the
 * boundary instead so a misconfigured deployment is obvious.
 */
const resolveBackendUrl = (path: string): string => {
	if (!BACKEND_ORIGIN) {
		throw new Error(
			'[server-fetch] HAM_BACKEND_ORIGIN is not configured — cannot reach the backend'
		);
	}
	return `${BACKEND_ORIGIN}${path}`;
};

/**
 * Outcome of reading a backend body: the parsed value plus whether it
 * was JSON at all.
 */
interface ParsedBody {
	isJson: boolean;
	value: unknown;
}

/**
 * Parse a backend response body without assuming it is JSON.
 *
 * 204/205 carry no body by definition, and a gateway error page or an
 * empty 200 is not JSON either. `Response.json()` rejects on all of
 * them, so the caller would report a network error for what is really
 * "the backend said nothing". The flag lets callers tell that case
 * apart from a payload that is genuinely `null`.
 */
const parseJsonBody = async (response: Response): Promise<ParsedBody> => {
	if (response.status === 204 || response.status === 205) {
		return { isJson: false, value: null };
	}
	const text = await response.text();
	if (text.trim() === '') {
		return { isJson: false, value: null };
	}
	try {
		return { isJson: true, value: JSON.parse(text) as unknown };
	} catch {
		return { isJson: false, value: null };
	}
};

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
 * Backend error envelope. Error responses from the backend follow
 * the shared errorx contract: { code, message }. Successful responses
 * are raw JSON payloads (NOT wrapped), matching what the BFF proxy
 * streams to the browser and what client-side request<T>() returns.
 */
interface BackendErrorEnvelope {
	code?: string | number;
	message?: string;
}

/**
 * Result of serverFetch: the raw Response (for status/headers access)
 * plus the parsed JSON body. For error responses, `errorEnvelope`
 * provides access to the backend's error code and message.
 */
export interface ServerFetchResult<T = unknown> {
	response: Response;
	data: T;
	errorEnvelope: BackendErrorEnvelope;
	/**
	 * Whether the body was valid JSON. `false` means the backend sent
	 * nothing parseable — a 204, an empty body, or an HTML error page —
	 * so `data` is `null` regardless of the status code. Callers must not
	 * mistake that for an empty payload.
	 */
	bodyIsJson: boolean;
}

/**
 * Make a server-side fetch to the backend, forwarding browser cookies.
 * Only auth-related cookies are forwarded to minimize information exposure.
 *
 * Unwraps error envelopes on non-OK responses so callers can access
 * the backend's error code and message. Successful responses are
 * returned as raw JSON — matching the pattern of _proxy.ts which
 * streams the raw backend body to the client, and of client-side
 * request<T>() which also returns raw JSON.
 *
 * C2 fix: Cookie header is only included when relevant cookies exist,
 * avoiding sending an empty `Cookie: ` header that could mislead the backend.
 */
export const serverFetch = async <T = unknown>(
	path: string,
	init?: RequestInit
): Promise<ServerFetchResult<T>> => {
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
		Accept: 'application/json',
		...(init?.body ? { 'Content-Type': 'application/json' } : {}),
		...(locale ? { 'Accept-Language': locale } : {}),
		...((init?.headers as Record<string, string>) ?? {}),
	};
	if (relevantCookies) {
		headers.Cookie = relevantCookies;
	}

	const response = await fetch(resolveBackendUrl(path), {
		...init,
		headers,
	});

	const { isJson: bodyIsJson, value: body } = await parseJsonBody(response);
	// Successful responses are raw JSON payloads (same shape the BFF proxy
	// streams to the client). Error responses may carry { code, message }.
	const isEnvelope =
		typeof body === 'object' &&
		body !== null &&
		'code' in body &&
		'message' in body;
	const data = (
		isEnvelope && 'data' in body ? (body as { data: T }).data : body
	) as T;
	const errorEnvelope: BackendErrorEnvelope = isEnvelope
		? (body as BackendErrorEnvelope)
		: {};
	return { response, data, errorEnvelope, bodyIsJson };
};
