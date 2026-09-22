/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/23 01:20:36
 *
 * Unit tests for the shared BFF proxy helper.
 *
 * The proxy owns the only hop between the browser and the backend, so a
 * request detail it drops is invisible at the call site: every route
 * handler looks correct while the backend silently receives less than the
 * caller sent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { proxyToBackend } from '@/app/api/_proxy';

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
});
