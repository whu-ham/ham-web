/**
 * @author Claude
 * @version 1.2
 * @date 2026/9/26 20:25:31
 *
 * Unit tests for the shared BFF proxy helper.
 *
 * The proxy owns the only hop between the browser and the backend, so a
 * request detail it drops is invisible at the call site: every route
 * handler looks correct while the backend silently receives less than the
 * caller sent. The suite therefore pins down what reaches the backend
 * (method, body, query, headers) and what comes back (status, body,
 * Set-Cookie, CORS), plus the two ways a call never leaves the BFF at
 * all: a missing backend origin and a rejected cross-site write.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { proxyToBackend } from '@/app/api/_proxy';

/**
 * Reload the proxy with a fresh module registry so the env vars it reads
 * once at import time (`HAM_BACKEND_ORIGIN`, `WEB_BASE_URL`) pick up the
 * values stubbed for the current test.
 */
const loadProxy = async (env: Record<string, string> = {}) => {
	vi.resetModules();
	for (const [name, value] of Object.entries(env)) {
		vi.stubEnv(name, value);
	}
	return import('@/app/api/_proxy');
};

const stubFetch = () => {
	const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
	vi.stubGlobal('fetch', fetch);
	return fetch;
};

const calledUrl = (fetch: ReturnType<typeof vi.fn>): string =>
	String((fetch.mock.calls[0] as unknown as [string])[0]);

describe('proxyToBackend', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('appends the caller query string to the backend path', async () => {
		const fetch = stubFetch();

		await proxyToBackend(
			new Request('https://ham.example.com/api/tokens?page=2&size=20'),
			'/web/tokens'
		);

		expect(calledUrl(fetch)).toBe(
			'http://localhost:8080/web/tokens?page=2&size=20'
		);
	});

	it('leaves the URL untouched when there is no query string', async () => {
		const fetch = stubFetch();

		await proxyToBackend(
			new Request('https://ham.example.com/api/auth/me'),
			'/web/auth/me'
		);

		expect(calledUrl(fetch)).toBe('http://localhost:8080/web/auth/me');
	});

	it('forwards the request method and strips the Host header', async () => {
		const fetch = stubFetch();

		await proxyToBackend(
			new Request('https://ham.example.com/api/auth/logout', {
				method: 'POST',
				headers: {
					host: 'ham.example.com',
					'content-type': 'application/json',
				},
				body: '{}',
			}),
			'/web/auth/logout'
		);

		const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		const headers = new Headers(init.headers as HeadersInit);
		expect(init.method).toBe('POST');
		expect(headers.get('host')).toBeNull();
		expect(headers.get('content-type')).toBe('application/json');
	});

	// The BFF authenticates on the session cookie alone, so the browser's
	// Fetch Metadata is what separates a write the user caused from one a
	// foreign page caused.
	it('rejects a cross-site write', async () => {
		const fetch = stubFetch();

		const res = await proxyToBackend(
			new Request('https://ham.example.com/api/tokens', {
				method: 'POST',
				headers: { 'sec-fetch-site': 'cross-site' },
				body: '{}',
			}),
			'/web/tokens'
		);

		expect(res.status).toBe(403);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('lets a same-origin write through', async () => {
		const fetch = stubFetch();

		const res = await proxyToBackend(
			new Request('https://ham.example.com/api/tokens', {
				method: 'POST',
				headers: { 'sec-fetch-site': 'same-origin' },
				body: '{}',
			}),
			'/web/tokens'
		);

		expect(res.status).toBe(200);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('does not treat reads as cross-site writes', async () => {
		const fetch = stubFetch();

		const res = await proxyToBackend(
			new Request('https://ham.example.com/api/tokens', {
				headers: { 'sec-fetch-site': 'cross-site' },
			}),
			'/web/tokens'
		);

		expect(res.status).toBe(200);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('lets non-browser clients through when metadata is absent', async () => {
		const fetch = stubFetch();

		const res = await proxyToBackend(
			new Request('https://ham.example.com/api/tokens', {
				method: 'DELETE',
			}),
			'/web/tokens'
		);

		expect(res.status).toBe(200);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('allows a cross-site write from a configured frontend origin', async () => {
		vi.resetModules();
		vi.stubEnv('WEB_BASE_URL', 'https://admin.example.com');
		const { proxyToBackend: proxied } = await import('@/app/api/_proxy');
		const fetch = stubFetch();

		const res = await proxied(
			new Request('https://ham.example.com/api/tokens', {
				method: 'POST',
				headers: {
					'sec-fetch-site': 'cross-site',
					origin: 'https://admin.example.com',
				},
				body: '{}',
			}),
			'/web/tokens'
		);

		expect(res.status).toBe(200);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('forwards the caller cookies so the backend sees the session', async () => {
		const fetch = stubFetch();

		await proxyToBackend(
			new Request('https://ham.example.com/api/auth/me', {
				headers: { cookie: 'ham_session=abc; ham_refresh=def' },
			}),
			'/web/auth/me'
		);

		const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(new Headers(init.headers as HeadersInit).get('cookie')).toBe(
			'ham_session=abc; ham_refresh=def'
		);
	});

	it('streams the request body on a write', async () => {
		const fetch = stubFetch();
		const req = new Request('https://ham.example.com/api/tokens', {
			method: 'POST',
			body: '{"name":"ci"}',
		});

		await proxyToBackend(req, '/web/tokens');

		const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(init.body).toBe(req.body);
	});

	it('sends no body for GET and HEAD', async () => {
		const fetch = stubFetch();

		await proxyToBackend(
			new Request('https://ham.example.com/api/tokens'),
			'/web/tokens'
		);
		await proxyToBackend(
			new Request('https://ham.example.com/api/tokens', { method: 'HEAD' }),
			'/web/tokens'
		);

		const inits = fetch.mock.calls.map(
			(call) => (call as unknown as [string, RequestInit])[1]
		);
		expect(inits.map((init) => init.method)).toEqual(['GET', 'HEAD']);
		expect(inits.every((init) => init.body === undefined)).toBe(true);
	});

	// HEAD and OPTIONS are reads for Fetch-Metadata purposes even when a
	// foreign page triggers them, so they must not hit the write guard.
	it('never treats HEAD or OPTIONS as a cross-site write', async () => {
		const fetch = stubFetch();

		for (const method of ['HEAD', 'OPTIONS']) {
			const res = await proxyToBackend(
				new Request('https://ham.example.com/api/tokens', {
					method,
					headers: { 'sec-fetch-site': 'cross-site' },
				}),
				'/web/tokens'
			);
			expect(res.status).toBe(200);
		}
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('propagates an upstream failure: status, body, cookies', async () => {
		const fetch = vi.fn(
			async () =>
				new Response('{"code":"12000","message":"upstream down"}', {
					status: 502,
					headers: {
						'content-type': 'application/json',
						'transfer-encoding': 'chunked',
						'set-cookie': 'ham_session=; Path=/; Max-Age=0',
					},
				})
		);
		vi.stubGlobal('fetch', fetch);

		const res = await proxyToBackend(
			new Request('https://ham.example.com/api/tokens'),
			'/web/tokens'
		);

		expect(res.status).toBe(502);
		await expect(res.text()).resolves.toBe(
			'{"code":"12000","message":"upstream down"}'
		);
		expect(res.headers.get('content-type')).toBe('application/json');
		// Transfer encoding is the runtime's business, not the client's.
		expect(res.headers.get('transfer-encoding')).toBeNull();
		expect(res.headers.getSetCookie()).toEqual([
			'ham_session=; Path=/; Max-Age=0',
		]);
	});

	// An unset origin used to degrade into a relative fetch, which fails
	// deep inside the runtime with an opaque "Failed to parse URL" and
	// reads like a backend outage.
	it('fails loudly when HAM_BACKEND_ORIGIN is not configured', async () => {
		const { proxyToBackend: unconfigured } = await loadProxy({
			HAM_BACKEND_ORIGIN: '',
		});
		const fetch = stubFetch();

		await expect(
			unconfigured(
				new Request('https://ham.example.com/api/auth/me'),
				'/web/auth/me'
			)
		).rejects.toThrow(/HAM_BACKEND_ORIGIN/);
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('handlePreflight', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	const preflightRequest = (origin?: string) =>
		new Request('https://ham.example.com/api/tokens', {
			method: 'OPTIONS',
			headers: origin ? { origin } : {},
		});

	// Single-origin deployments send no CORS headers at all: the browser
	// never needs them, and echoing `*` here would break credentialed
	// calls outright.
	it('answers a bare 204 when no frontend origin is configured', async () => {
		const { handlePreflight: preflight } = await loadProxy();

		const res = preflight(preflightRequest('https://admin.example.com'));

		expect(res.status).toBe(204);
		expect(res.headers.get('vary')).toBe('Origin');
		expect(res.headers.get('access-control-allow-origin')).toBeNull();
		expect(res.headers.get('access-control-allow-methods')).toBeNull();
	});

	it('advertises the allowed methods for a configured frontend', async () => {
		const { handlePreflight: preflight } = await loadProxy({
			WEB_BASE_URL: 'https://admin.example.com',
		});

		const res = preflight(preflightRequest('https://admin.example.com'));

		expect(res.status).toBe(204);
		expect(res.headers.get('access-control-allow-origin')).toBe(
			'https://admin.example.com'
		);
		expect(res.headers.get('access-control-allow-credentials')).toBe('true');
		expect(res.headers.get('access-control-allow-methods')).toBe(
			'GET, POST, PUT, PATCH, DELETE, OPTIONS'
		);
		expect(res.headers.get('access-control-allow-headers')).toBe(
			'Content-Type, Accept, Accept-Language, Authorization'
		);
		expect(res.headers.get('access-control-max-age')).toBe('86400');
	});

	it('tolerates a trailing slash in a configured origin', async () => {
		const { handlePreflight: preflight } = await loadProxy({
			WEB_BASE_URL: 'https://admin.example.com/',
		});

		const res = preflight(preflightRequest('https://admin.example.com'));

		expect(res.headers.get('access-control-allow-origin')).toBe(
			'https://admin.example.com'
		);
	});

	it('withholds the allow headers from an origin outside the list', async () => {
		const { handlePreflight: preflight } = await loadProxy({
			WEB_BASE_URL: 'https://admin.example.com',
		});

		const res = preflight(preflightRequest('https://evil.example.com'));

		expect(res.status).toBe(204);
		expect(res.headers.get('vary')).toBe('Origin');
		expect(res.headers.get('access-control-allow-origin')).toBeNull();
		expect(res.headers.get('access-control-allow-methods')).toBeNull();
	});

	it('adds no CORS headers when the caller sends no Origin', async () => {
		const { handlePreflight: preflight } = await loadProxy({
			WEB_BASE_URL: 'https://admin.example.com',
		});

		const res = preflight(preflightRequest());

		expect(res.status).toBe(204);
		expect(res.headers.get('access-control-allow-origin')).toBeNull();
	});
});

describe('proxyToBackend — cross-origin responses', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('echoes an allow-listed origin on the proxied response', async () => {
		const { proxyToBackend: proxied } = await loadProxy({
			WEB_BASE_URL: 'https://admin.example.com, https://ops.example.com',
		});
		stubFetch();

		const res = await proxied(
			new Request('https://ham.example.com/api/auth/me', {
				headers: { origin: 'https://ops.example.com' },
			}),
			'/web/auth/me'
		);

		expect(res.status).toBe(200);
		expect(res.headers.get('access-control-allow-origin')).toBe(
			'https://ops.example.com'
		);
		expect(res.headers.get('access-control-allow-credentials')).toBe('true');
		expect(res.headers.get('vary')).toBe('Origin');
	});

	it('adds no CORS headers for a caller outside the allow-list', async () => {
		const { proxyToBackend: proxied } = await loadProxy({
			WEB_BASE_URL: 'https://admin.example.com',
		});
		stubFetch();

		const res = await proxied(
			new Request('https://ham.example.com/api/auth/me', {
				headers: { origin: 'https://evil.example.com' },
			}),
			'/web/auth/me'
		);

		expect(res.headers.get('access-control-allow-origin')).toBeNull();
		expect(res.headers.get('vary')).toBe('Origin');
	});

	// The write guard and the CORS echo share one allow-list, so a
	// cross-site POST from an unlisted origin is rejected here as well.
	it('still rejects a cross-site write from an unlisted origin', async () => {
		const { proxyToBackend: proxied } = await loadProxy({
			WEB_BASE_URL: 'https://admin.example.com',
		});
		const fetch = stubFetch();

		const res = await proxied(
			new Request('https://ham.example.com/api/tokens', {
				method: 'POST',
				headers: {
					'sec-fetch-site': 'cross-site',
					origin: 'https://evil.example.com',
				},
				body: '{}',
			}),
			'/web/tokens'
		);

		expect(res.status).toBe(403);
		expect(fetch).not.toHaveBeenCalled();
	});
});
