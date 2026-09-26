/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the shared HTTP client: `API_BASE`, `ApiError` and
 * `request<T>()`.
 *
 * Every service module funnels its calls through `request`, so the
 * details asserted here are the contract the whole API layer relies on:
 * the envelope unwrap, the 204 short-circuit, the error envelope, and
 * the two headers the backend needs (Accept-Language and Content-Type).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCALE_COOKIE } from '@/services/cookies';
import { API_BASE, ApiError, request } from '@/services/shared';

type FetchInit = RequestInit & { headers: Record<string, string> };

const lastFetch = () => {
	const fetchMock = vi.mocked(fetch);
	expect(fetchMock).toHaveBeenCalledTimes(1);
	return fetchMock.mock.calls[0] as unknown as [string, FetchInit];
};

const jsonResponse = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});

const stubFetch = (response: Response) => {
	const fetchMock = vi.fn(async () => response);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
};

const setLocaleCookie = (value: string) => {
	document.cookie = `${LOCALE_COOKIE}=${value}; Path=/`;
};

const clearLocaleCookie = () => {
	document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
};

describe('API_BASE', () => {
	// `NEXT_PUBLIC_API_BASE` is unset in tests, so every request must go to
	// the same-origin BFF. A single-origin deployment depends on that
	// default — otherwise it would need env config just to boot.
	it('falls back to the same-origin /api prefix', () => {
		expect(API_BASE).toBe('/api');
	});

	it('prefixes the configured BFF origin', async () => {
		vi.stubEnv('NEXT_PUBLIC_API_BASE', 'https://bff.example.com');
		vi.resetModules();
		const mod = await import('@/services/shared');
		vi.unstubAllEnvs();

		expect(mod.API_BASE).toBe('https://bff.example.com/api');
	});

	it('sends requests to the BFF base with credentials included', async () => {
		stubFetch(jsonResponse(200, { ok: true }));

		await request('/auth/me');

		const [url, init] = lastFetch();
		expect(url).toBe(`${API_BASE}/auth/me`);
		expect(init.credentials).toBe('include');
	});
});

describe('ApiError', () => {
	it('carries the backend code and message', () => {
		const error = new ApiError(400, { code: '12002', message: 'bad request' });

		expect(error.status).toBe(400);
		expect(error.code).toBe('12002');
		expect(error.message).toBe('bad request');
	});

	// A gateway error page has no JSON to parse, so the envelope is absent
	// and the error still has to say something actionable.
	it('falls back to the status when there is no envelope', () => {
		const error = new ApiError(503);

		expect(error.status).toBe(503);
		expect(error.code).toBe('503');
		expect(error.message).toBe('request failed: 503');
	});

	it('is an Error', () => {
		expect(new ApiError(500)).toBeInstanceOf(Error);
	});
});

describe('request', () => {
	beforeEach(() => {
		clearLocaleCookie();
	});

	afterEach(() => {
		clearLocaleCookie();
		vi.unstubAllGlobals();
	});

	// The backend wraps every reply in { code, message, data }; callers
	// want the payload, not the envelope.
	it('unwraps the standard response envelope', async () => {
		stubFetch(
			jsonResponse(200, { code: '0', message: 'ok', data: { user_id: 'u_1' } })
		);

		await expect(request<{ user_id: string }>('/auth/me')).resolves.toEqual({
			user_id: 'u_1',
		});
	});

	it('returns a bare payload untouched', async () => {
		stubFetch(jsonResponse(200, [{ id: 'tok_1' }]));

		await expect(request<unknown>('/tokens')).resolves.toEqual([
			{ id: 'tok_1' },
		]);
	});

	// `data` alone is not an envelope: a payload that happens to carry a
	// `data` key must not be unwrapped by accident.
	it('returns a payload that only looks like an envelope', async () => {
		stubFetch(jsonResponse(200, { code: 'x', data: 1 }));

		await expect(request<unknown>('/tokens')).resolves.toEqual({
			code: 'x',
			data: 1,
		});
	});

	it('returns a JSON null payload as null', async () => {
		stubFetch(jsonResponse(200, null));

		await expect(request<unknown>('/auth/me')).resolves.toBeNull();
	});

	it('resolves undefined for a 204 No Content reply', async () => {
		stubFetch(new Response(null, { status: 204 }));

		await expect(
			request<void>('/auth/logout', { method: 'POST' })
		).resolves.toBeUndefined();
	});

	it('throws an ApiError carrying the backend envelope', async () => {
		stubFetch(jsonResponse(401, { code: '11001', message: 'not signed in' }));

		const error = await request('/auth/me').catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(401);
		expect((error as ApiError).code).toBe('11001');
		expect((error as ApiError).message).toBe('not signed in');
	});

	it('throws an ApiError when the error body is not JSON', async () => {
		stubFetch(new Response('<html>502</html>', { status: 502 }));

		const error = await request('/auth/me').catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(502);
		expect((error as ApiError).code).toBe('502');
		expect((error as ApiError).message).toBe('request failed: 502');
	});

	it('sends Accept-Language from the locale cookie', async () => {
		stubFetch(jsonResponse(200, {}));
		setLocaleCookie('ja');

		await request('/auth/me');

		expect(lastFetch()[1].headers['Accept-Language']).toBe('ja');
	});

	// Without an explicit override the browser's own Accept-Language is the
	// better answer, so no header must be sent at all.
	it('omits Accept-Language when no locale cookie is set', async () => {
		stubFetch(jsonResponse(200, {}));

		await request('/auth/me');

		expect(lastFetch()[1].headers).not.toHaveProperty('Accept-Language');
	});

	it('sends Content-Type only when there is a body', async () => {
		stubFetch(jsonResponse(200, {}));

		await request('/sso/consent/info', {
			method: 'POST',
			body: JSON.stringify({ state: 's' }),
		});

		expect(lastFetch()[1].headers['Content-Type']).toBe('application/json');
	});

	it('omits Content-Type for a bodyless request', async () => {
		stubFetch(jsonResponse(200, {}));

		await request('/tokens');

		expect(lastFetch()[1].headers).not.toHaveProperty('Content-Type');
	});

	it('lets caller-supplied headers win', async () => {
		stubFetch(jsonResponse(200, {}));
		setLocaleCookie('ja');

		await request('/auth/me', {
			headers: { 'Accept-Language': 'en', 'X-Trace': 'abc' },
		});

		const headers = lastFetch()[1].headers;
		expect(headers['Accept-Language']).toBe('en');
		expect(headers['X-Trace']).toBe('abc');
	});
});
