/**
 * @author Claude
 * @version 1.2
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for serverFetch — defensive body parsing, cookie forwarding
 * and backend-origin validation.
 *
 * The backend replies are not uniformly JSON: a 204 carries no body at
 * all and a gateway error page answers an HTML document instead. Letting
 * `response.json()` reject on those turned "the backend said nothing"
 * into a network failure that surfaced as a misleading error on the
 * login and consent screens.
 *
 * The parse flag is what keeps that from going the other way: a 200 that
 * carries no JSON must not be reported as an empty payload, or a
 * signed-in user gets bounced to /login.
 *
 * Only the cookies the backend needs are forwarded. Everything else —
 * analytics ids, in-flight login state — is stripped, so a backend
 * compromise cannot read it and an oversized jar cannot break the
 * request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cookieStore } = vi.hoisted(() => ({
	cookieStore: {
		get: vi.fn(),
		getAll: vi.fn(),
		set: vi.fn(),
	},
}));

vi.mock('next/headers', () => ({
	cookies: async () => cookieStore,
}));

import {
	LOCALE_COOKIE,
	REFRESH_COOKIE,
	SESSION_COOKIE,
	THEME_COOKIE,
} from '@/services/cookies';
import { serverFetch } from '@/services/server-fetch';

/**
 * The stub is typed from the outside so the recorded calls keep their
 * (`[url, init]`) shape; a mock inferred from the implementation types
 * `calls[0]` as `[]`.
 */
type FetchStub = (url: string, init?: RequestInit) => Promise<Response>;

const stubFetch = (init: { status: number; body?: string }) => {
	const fetch = vi.fn<FetchStub>(
		async () => new Response(init.body ?? null, { status: init.status })
	);
	vi.stubGlobal('fetch', fetch);
	return fetch;
};

/**
 * The headers of the first recorded call, exactly as they were written:
 * wrapping them in `Headers` would fold the casing and hide a name that
 * the backend reads case-sensitively.
 */
const headersSent = (fetchMock: ReturnType<typeof stubFetch>) =>
	(fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;

describe('serverFetch', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
		cookieStore.get.mockReturnValue(undefined);
		cookieStore.getAll.mockReturnValue([]);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('returns null for a 204 No Content reply', async () => {
		stubFetch({ status: 204 });

		const { data, errorEnvelope, bodyIsJson } = await serverFetch(
			'/web/auth/logout',
			{ method: 'POST' }
		);

		expect(data).toBeNull();
		expect(bodyIsJson).toBe(false);
		expect(errorEnvelope).toEqual({});
	});

	it('returns null for an empty 200 body', async () => {
		stubFetch({ status: 200, body: '' });

		const { data, bodyIsJson } = await serverFetch('/web/tokens');

		expect(data).toBeNull();
		expect(bodyIsJson).toBe(false);
	});

	it('returns null for a non-JSON body instead of throwing', async () => {
		stubFetch({ status: 200, body: '<html>gateway error</html>' });

		// The 200 is the dangerous case: without the flag a caller cannot
		// tell this apart from a genuinely empty payload.
		const { data, bodyIsJson } = await serverFetch('/web/tokens');

		expect(data).toBeNull();
		expect(bodyIsJson).toBe(false);
	});

	it('unwraps the backend error envelope on failure', async () => {
		stubFetch({
			status: 400,
			body: JSON.stringify({ code: '12002', message: 'token limit reached' }),
		});

		const { response, errorEnvelope } = await serverFetch('/web/tokens', {
			method: 'POST',
		});

		expect(response.ok).toBe(false);
		expect(errorEnvelope).toEqual({
			code: '12002',
			message: 'token limit reached',
		});
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('keeps raw JSON payloads untouched', async () => {
		stubFetch({ status: 200, body: JSON.stringify([{ id: 'tok_1' }]) });

		const { data, bodyIsJson } =
			await serverFetch<{ id: string }[]>('/web/tokens');

		expect(data).toEqual([{ id: 'tok_1' }]);
		expect(bodyIsJson).toBe(true);
	});

	it('reports a JSON null payload as parsed', async () => {
		stubFetch({ status: 200, body: 'null' });

		const { data, bodyIsJson } = await serverFetch('/web/tokens');

		expect(data).toBeNull();
		expect(bodyIsJson).toBe(true);
	});

	// A successful reply that happens to carry a `data` key alongside
	// code/message is an envelope, not a raw payload.
	it('unwraps an envelope on a successful reply', async () => {
		stubFetch({
			status: 200,
			body: JSON.stringify({ code: '0', message: 'ok', data: { id: 'tok_1' } }),
		});

		const { data, errorEnvelope } = await serverFetch<{ id: string }>(
			'/web/tokens'
		);

		expect(data).toEqual({ id: 'tok_1' });
		// The envelope is the parsed body itself, so a `data` key rides
		// along — callers read `code`/`message` off it and ignore the rest.
		expect(errorEnvelope).toMatchObject({ code: '0', message: 'ok' });
	});

	it('calls the configured backend origin', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });

		await serverFetch('/web/tokens');

		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'http://localhost:8080/web/tokens'
		);
	});
});

describe('serverFetch cookie forwarding', () => {
	beforeEach(() => {
		cookieStore.get.mockReturnValue(undefined);
		cookieStore.getAll.mockReturnValue([]);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('forwards only the cookies the backend needs', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });
		cookieStore.getAll.mockReturnValue([
			{ name: SESSION_COOKIE, value: 'sess-1' },
			{ name: REFRESH_COOKIE, value: 'ref-1' },
			{ name: LOCALE_COOKIE, value: 'ja' },
			{ name: THEME_COOKIE, value: 'dark' },
			// Frontend-only state: an in-flight login must not leak, and a
			// third-party analytics id is none of the backend's business.
			{ name: 'ham_login_state', value: 'st-1' },
			{ name: 'analytics_id', value: 'a-1' },
		]);

		await serverFetch('/web/tokens');

		expect(headersSent(fetchMock).Cookie).toBe(
			'ham_session=sess-1; ham_refresh=ref-1; NEXT_LOCALE=ja; NEXT_THEME=dark'
		);
	});

	// An empty `Cookie:` header makes the backend believe the request is
	// authenticated-but-empty, which is worse than no header at all.
	it('sends no Cookie header when nothing is forwardable', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });
		cookieStore.getAll.mockReturnValue([
			{ name: 'analytics_id', value: 'a-1' },
		]);

		await serverFetch('/web/tokens');

		expect(headersSent(fetchMock)).not.toHaveProperty('Cookie');
	});

	it('sends no Cookie header when the jar is empty', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });

		await serverFetch('/web/tokens');

		expect(headersSent(fetchMock)).not.toHaveProperty('Cookie');
	});

	it('sends Accept-Language from the locale cookie', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });
		cookieStore.get.mockReturnValue({ value: 'zh-CN' });

		await serverFetch('/web/tokens');

		expect(headersSent(fetchMock)['Accept-Language']).toBe('zh-CN');
	});

	it('omits Accept-Language when there is no locale cookie', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });

		await serverFetch('/web/tokens');

		expect(headersSent(fetchMock)).not.toHaveProperty('Accept-Language');
	});

	it('always asks for JSON', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });

		await serverFetch('/web/tokens');

		expect(headersSent(fetchMock).Accept).toBe('application/json');
	});

	it('sends Content-Type only when there is a body', async () => {
		const withBody = stubFetch({ status: 200, body: '{}' });
		await serverFetch('/web/tokens', { method: 'POST', body: '{"name":"ci"}' });
		expect(headersSent(withBody)['Content-Type']).toBe('application/json');

		vi.unstubAllGlobals();
		const withoutBody = stubFetch({ status: 200, body: '{}' });
		await serverFetch('/web/tokens');
		expect(headersSent(withoutBody)).not.toHaveProperty('Content-Type');
	});

	it('lets caller headers override the defaults', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });
		cookieStore.get.mockReturnValue({ value: 'ja' });

		await serverFetch('/web/tokens', {
			headers: { Accept: 'text/plain', 'X-Trace': 'abc' },
		});

		const headers = headersSent(fetchMock);
		expect(headers.Accept).toBe('text/plain');
		expect(headers['X-Trace']).toBe('abc');
		// Only the keys the caller set are overridden.
		expect(headers['Accept-Language']).toBe('ja');
	});

	it('forwards the method and body it is given', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });

		await serverFetch('/web/tokens', { method: 'POST', body: '{"a":1}' });

		const [, init] =
			(fetchMock.mock.calls[0] as [string, RequestInit] | undefined) ?? [];
		expect(init?.method).toBe('POST');
		expect(init?.body).toBe('{"a":1}');
	});
});

describe('serverFetch origin validation', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	// A missing origin used to degrade into a relative `fetch('/web/...')`,
	// which fails deep inside undici with "Failed to parse URL" and looks
	// like a backend outage. Failing at the boundary names the cause.
	it('rejects when HAM_BACKEND_ORIGIN is not configured', async () => {
		const fetchMock = stubFetch({ status: 200, body: '{}' });
		cookieStore.get.mockReturnValue(undefined);
		cookieStore.getAll.mockReturnValue([]);
		vi.stubEnv('HAM_BACKEND_ORIGIN', '');
		vi.resetModules();
		const mod = await import('@/services/server-fetch');

		await expect(mod.serverFetch('/web/tokens')).rejects.toThrow(
			/HAM_BACKEND_ORIGIN is not configured/
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
