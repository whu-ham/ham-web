/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:45:00
 *
 * Unit tests for the browser OAuth callback: /login/oauth/{provider}/callback.
 *
 * This handler is the leg that actually signs a user in, so the tests pin
 * what it does with three things it must not get wrong:
 *
 * - the CSRF state. A callback whose state does not match the stored
 *   cookie — or that arrives with no cookie at all — must be refused
 *   before the code is ever sent to the backend.
 * - the `redirect_uri`. Providers compare it against the one the code was
 *   requested with and reject a mismatch, so it is rebuilt from the
 *   request origin rather than read from the query string: a caller who
 *   supplies their own would only break their own exchange, or use the
 *   handler to probe the backend with arbitrary URIs.
 * - the session cookies the backend issues, which have to ride back on
 *   the redirect or the user lands on /console still logged out.
 *
 * Failures are asserted on the `error` code and on the absence of
 * backend text: the message reaches the browser through the redirect URL,
 * and a backend envelope can name internals.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { cookieStore } = vi.hoisted(() => ({
	cookieStore: {
		get: vi.fn(),
		getAll: vi.fn(() => []),
		set: vi.fn(),
		delete: vi.fn(),
	},
}));

// The cookie jar is the only channel between the start endpoint and this
// callback, so it is stubbed at the next/headers boundary.
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

import { GET, POST } from '@/app/login/oauth/[provider]/callback/route';
import { FROM_COOKIE, STATE_COOKIE } from '@/services/cookies';

const ORIGIN = 'https://ham.example.com';

/** A GET callback request for `provider`, as the provider would issue it. */
const callbackGet = (provider: string, query = '') =>
	new NextRequest(
		new Request(`${ORIGIN}/login/oauth/${provider}/callback${query}`)
	);

/** A POST callback request (Apple answers with response_mode=form_post). */
const callbackPost = (provider: string, init: RequestInit, query = '') =>
	new NextRequest(
		new Request(`${ORIGIN}/login/oauth/${provider}/callback${query}`, {
			method: 'POST',
			...init,
		})
	);

type Params = { params: Promise<{ provider: string }> };
const paramsFor = (provider: string): Params => ({
	params: Promise.resolve({ provider }),
});

const urlencoded = (fields: Record<string, string>) => ({
	headers: { 'content-type': 'application/x-www-form-urlencoded' },
	body: new URLSearchParams(fields).toString(),
});

const jsonBody = (payload: Record<string, unknown>) => ({
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify(payload),
});

/** Stub the backend exchange. Defaults to a successful, cookieless reply. */
const stubBackend = (init?: {
	status?: number;
	body?: string;
	setCookies?: string[];
}) => {
	const headers = (init?.setCookies ?? []).map(
		(cookie) => ['Set-Cookie', cookie] as [string, string]
	);
	const fetchMock = vi.fn(
		async () =>
			new Response(init?.body ?? '{}', { status: init?.status ?? 200, headers })
	);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
};

/** Where the handler sent the exchange, and what it put in the body. */
const lastExchange = (fetchMock: ReturnType<typeof stubBackend>) => {
	const call = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
	return {
		url: call[0],
		method: call[1].method,
		payload: JSON.parse(String(call[1].body)) as Record<string, string>,
	};
};

/** The redirect target, split so the assertions do not depend on ordering. */
const redirectTo = (res: Response) =>
	new URL(String(res.headers.get('location')));

const setCookies = (res: Response) => res.headers.getSetCookie?.() ?? [];

/** Whether a `Set-Cookie` entry expires `name` (value emptied, epoch date). */
const expiresCookie = (res: Response, name: string) =>
	setCookies(res).some(
		(cookie) => cookie.startsWith(`${name}=;`) && cookie.includes('1970')
	);

const jar = new Map<string, string>();

describe('GET /login/oauth/[provider]/callback', () => {
	beforeEach(() => {
		jar.clear();
		cookieStore.get.mockImplementation((name: string) => {
			const value = jar.get(name);
			return value === undefined ? undefined : { value };
		});
		cookieStore.getAll.mockReturnValue([]);
		cookieStore.set.mockClear();
		cookieStore.delete.mockClear();
		// The failure legs log the backend text on purpose; the suite does not
		// need it printed.
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('exchanges the code and replays the backend session cookies', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		jar.set(FROM_COOKIE, '/console/tokens');
		const backend = stubBackend({
			setCookies: [
				'ham_session=sess-1; Path=/; HttpOnly',
				'ham_refresh=ref-1; Path=/; HttpOnly',
			],
		});

		const res = await GET(
			callbackGet('github', '?code=code-1&state=st-1'),
			paramsFor('github')
		);

		const { url, method, payload } = lastExchange(backend);
		expect(url).toBe('http://localhost:8080/web/auth/oauth/github/callback');
		expect(method).toBe('POST');
		expect(payload).toEqual({
			code: 'code-1',
			state: 'st-1',
			redirect_uri: `${ORIGIN}/login/oauth/github/callback`,
		});

		const target = redirectTo(res);
		expect(res.status).toBe(307);
		expect(target.pathname).toBe('/console/tokens');
		// The session is the whole point of the exchange: without these the
		// user is redirected to /console still logged out.
		expect(setCookies(res)).toContain('ham_session=sess-1; Path=/; HttpOnly');
		expect(setCookies(res)).toContain('ham_refresh=ref-1; Path=/; HttpOnly');
		// The one-time pair is spent.
		expect(expiresCookie(res, STATE_COOKIE)).toBe(true);
		expect(expiresCookie(res, FROM_COOKIE)).toBe(true);
	});

	// A provider compares redirect_uri against the one the code was issued
	// for and rejects a mismatch, so the value has to be rebuilt here.
	// Trusting the query string would also let a caller aim the exchange at
	// any URI they like.
	it('rebuilds redirect_uri instead of taking it from the request', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		await GET(
			callbackGet(
				'soruxgpt',
				`?code=code-1&state=st-1&redirect_uri=${encodeURIComponent('https://evil.example.com/hook')}`
			),
			paramsFor('soruxgpt')
		);

		const { url, payload } = lastExchange(backend);
		expect(payload.redirect_uri).toBe(
			`${ORIGIN}/login/oauth/soruxgpt/callback`
		);
		// Nothing is ever sent to the supplied host.
		expect(url.startsWith('http://localhost:8080/')).toBe(true);
		expect(backend).toHaveBeenCalledTimes(1);
	});

	it('accepts an id_token when the provider returns no code', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		jar.set(FROM_COOKIE, '/console');
		const backend = stubBackend();

		const res = await GET(
			callbackGet('apple', '?id_token=idt-1&state=st-1'),
			paramsFor('apple')
		);

		const { payload } = lastExchange(backend);
		expect(payload.id_token).toBe('idt-1');
		expect(payload).not.toHaveProperty('code');
		expect(redirectTo(res).pathname).toBe('/console');
	});

	it('accepts an identity_token when the provider returns no code', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		await GET(
			callbackGet('apple', '?identity_token=apple-idt&state=st-1'),
			paramsFor('apple')
		);

		expect(lastExchange(backend).payload.identity_token).toBe('apple-idt');
	});

	it('accepts an access_token when the provider returns no code', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		await GET(
			callbackGet('qq', '?access_token=at-1&state=st-1'),
			paramsFor('qq')
		);

		expect(lastExchange(backend).payload.access_token).toBe('at-1');
	});

	it('returns to /console when no destination was stored', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		stubBackend();

		const res = await GET(
			callbackGet('github', '?code=code-1&state=st-1'),
			paramsFor('github')
		);

		expect(redirectTo(res).pathname).toBe('/console');
	});

	// The state is the only thing binding the callback to the login the
	// browser actually started; a mismatch means the code was injected.
	it('refuses a state that does not match the stored cookie', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		jar.set(FROM_COOKIE, '/console/tokens');
		const backend = stubBackend();

		const res = await GET(
			callbackGet('github', '?code=code-1&state=forged'),
			paramsFor('github')
		);

		const target = redirectTo(res);
		expect(target.pathname).toBe('/login');
		expect(target.searchParams.get('error')).toBe('invalid_state');
		// The destination survives so the user can retry from where they were.
		expect(target.searchParams.get('from')).toBe('/console/tokens');
		expect(backend).not.toHaveBeenCalled();
		expect(cookieStore.delete).toHaveBeenCalledWith(STATE_COOKIE);
		expect(cookieStore.delete).toHaveBeenCalledWith(FROM_COOKIE);
	});

	it('refuses a callback that arrives without a stored state', async () => {
		stubBackend();

		const res = await GET(
			callbackGet('github', '?code=code-1&state=st-1'),
			paramsFor('github')
		);

		const target = redirectTo(res);
		expect(target.searchParams.get('error')).toBe('invalid_state');
		expect(target.searchParams.get('from')).toBe('/console');
	});

	// The backend message is logged, never shown: it travels through
	// ?error= and can carry internals.
	it('reports a rejected exchange as oauth_failed without the backend text', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		jar.set(FROM_COOKIE, '/console');
		const backend = stubBackend({
			status: 400,
			body: JSON.stringify({
				code: '12001',
				message: 'redis 10.0.0.7 refused',
			}),
		});

		const res = await GET(
			callbackGet('github', '?code=code-1&state=st-1'),
			paramsFor('github')
		);

		const target = redirectTo(res);
		expect(target.searchParams.get('error')).toBe('oauth_failed');
		expect(String(target)).not.toContain('10.0.0.7');
		expect(backend).toHaveBeenCalledTimes(1);
		expect(cookieStore.delete).toHaveBeenCalledWith(STATE_COOKIE);
	});

	it('reports an unreachable backend as oauth_failed', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const fetchMock = vi.fn(async () => {
			throw new Error('connect ECONNREFUSED 10.0.0.7:8080');
		});
		vi.stubGlobal('fetch', fetchMock);

		const res = await GET(
			callbackGet('github', '?code=code-1&state=st-1'),
			paramsFor('github')
		);

		const target = redirectTo(res);
		expect(target.searchParams.get('error')).toBe('oauth_failed');
		expect(String(target)).not.toContain('10.0.0.7');
		expect(cookieStore.delete).toHaveBeenCalledWith(STATE_COOKIE);
		// The cause is logged for diagnosis instead.
		expect(console.error).toHaveBeenCalled();
	});

	it('rejects an unknown provider before reading any cookie', async () => {
		const backend = stubBackend();

		const res = await GET(
			callbackGet('evil', '?code=code-1&state=st-1&from=/console/tokens'),
			paramsFor('evil')
		);

		const target = redirectTo(res);
		expect(target.pathname).toBe('/login');
		expect(target.searchParams.get('error')).toBe('unsupported_provider');
		expect(target.searchParams.get('from')).toBe('/console/tokens');
		expect(backend).not.toHaveBeenCalled();
		expect(cookieStore.get).not.toHaveBeenCalled();
	});

	it('rejects a callback that carries neither a code nor a token', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await GET(
			callbackGet('github', '?state=st-1'),
			paramsFor('github')
		);

		expect(redirectTo(res).searchParams.get('error')).toBe('missing_payload');
		expect(backend).not.toHaveBeenCalled();
	});

	it('sends an unknown provider back to /console when no destination is given', async () => {
		const backend = stubBackend();

		const res = await GET(
			callbackGet('evil', '?code=code-1&state=st-1'),
			paramsFor('evil')
		);

		const target = redirectTo(res);
		expect(target.searchParams.get('error')).toBe('unsupported_provider');
		expect(target.searchParams.get('from')).toBe('/console');
		expect(backend).not.toHaveBeenCalled();
	});
});

describe('POST /login/oauth/[provider]/callback', () => {
	beforeEach(() => {
		jar.clear();
		cookieStore.get.mockImplementation((name: string) => {
			const value = jar.get(name);
			return value === undefined ? undefined : { value };
		});
		cookieStore.getAll.mockReturnValue([]);
		cookieStore.set.mockClear();
		cookieStore.delete.mockClear();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	// Apple is configured with response_mode=form_post, so its callback is
	// a cross-site POST: this leg is the only way an Apple login completes.
	it('exchanges a form-encoded body', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		jar.set(FROM_COOKIE, '/console');
		const backend = stubBackend({ setCookies: ['ham_session=sess-1; Path=/'] });

		const res = await POST(
			callbackPost('apple', urlencoded({ code: 'code-1', state: 'st-1' })),
			paramsFor('apple')
		);

		const { payload } = lastExchange(backend);
		expect(payload.code).toBe('code-1');
		expect(payload.state).toBe('st-1');
		expect(redirectTo(res).pathname).toBe('/console');
		expect(setCookies(res)).toContain('ham_session=sess-1; Path=/');
	});

	it('exchanges a multipart body', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();
		const form = new FormData();
		form.set('code', 'code-1');
		form.set('identity_token', 'idt-1');
		form.set('state', 'st-1');

		await POST(callbackPost('apple', { body: form }), paramsFor('apple'));

		const { payload } = lastExchange(backend);
		expect(payload.code).toBe('code-1');
		expect(payload.identity_token).toBe('idt-1');
	});

	it('exchanges a JSON body', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		await POST(
			callbackPost('github', jsonBody({ code: 'code-1', state: 'st-1' })),
			paramsFor('github')
		);

		expect(lastExchange(backend).payload.code).toBe('code-1');
	});

	// The provider posts its own payload; a stale query string must not win.
	it('prefers the posted payload over the query string', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await POST(
			callbackPost(
				'github',
				jsonBody({ code: 'fresh', state: 'st-1' }),
				'?code=stale&state=stale'
			),
			paramsFor('github')
		);

		const { payload } = lastExchange(backend);
		expect(payload.code).toBe('fresh');
		expect(payload.state).toBe('st-1');
		expect(redirectTo(res).pathname).toBe('/console');
	});

	it('treats an unparseable JSON body as an empty payload', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await POST(
			callbackPost('github', {
				headers: { 'content-type': 'application/json' },
				body: 'not json',
			}),
			paramsFor('github')
		);

		expect(redirectTo(res).searchParams.get('error')).toBe('missing_payload');
		expect(backend).not.toHaveBeenCalled();
	});

	// A truncated multipart body makes formData() throw, which would
	// otherwise surface as an unhandled 500 instead of a redirect.
	it('treats an unparseable form body as an empty payload', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await POST(
			callbackPost('apple', {
				headers: { 'content-type': 'multipart/form-data; boundary=b' },
				body: 'truncated',
			}),
			paramsFor('apple')
		);

		expect(redirectTo(res).searchParams.get('error')).toBe('missing_payload');
		expect(backend).not.toHaveBeenCalled();
	});

	it('ignores a body it has no reader for', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await POST(
			callbackPost('github', {
				headers: { 'content-type': 'text/plain' },
				body: 'code=code-1&state=st-1',
			}),
			paramsFor('github')
		);

		expect(redirectTo(res).searchParams.get('error')).toBe('missing_payload');
		expect(backend).not.toHaveBeenCalled();
	});

	it('treats a POST with no body at all as an empty payload', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await POST(callbackPost('github', {}), paramsFor('github'));

		expect(redirectTo(res).searchParams.get('error')).toBe('missing_payload');
		expect(backend).not.toHaveBeenCalled();
	});

	// A blank field is not a credential: forwarding "" would send an empty
	// code to the backend and turn a malformed callback into an opaque
	// backend error.
	it('treats a blank code field as absent', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await POST(
			callbackPost('apple', urlencoded({ code: '', state: 'st-1' })),
			paramsFor('apple')
		);

		expect(redirectTo(res).searchParams.get('error')).toBe('missing_payload');
		expect(backend).not.toHaveBeenCalled();
	});

	it('refuses a blank state field', async () => {
		jar.set(STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await POST(
			callbackPost('apple', urlencoded({ code: 'code-1', state: '' })),
			paramsFor('apple')
		);

		expect(redirectTo(res).searchParams.get('error')).toBe('invalid_state');
		expect(backend).not.toHaveBeenCalled();
	});

	it('rejects an unknown provider', async () => {
		const backend = stubBackend();

		const res = await POST(
			callbackPost(
				'evil',
				jsonBody({ code: 'code-1', state: 'st-1' }),
				'?from=/sso-authorize'
			),
			paramsFor('evil')
		);

		const target = redirectTo(res);
		expect(target.searchParams.get('error')).toBe('unsupported_provider');
		expect(target.searchParams.get('from')).toBe('/sso-authorize');
		expect(backend).not.toHaveBeenCalled();
	});

	it('falls back to /console for an unknown provider with no destination', async () => {
		const backend = stubBackend();

		const res = await POST(
			callbackPost('evil', jsonBody({ code: 'code-1' })),
			paramsFor('evil')
		);

		const target = redirectTo(res);
		expect(target.searchParams.get('error')).toBe('unsupported_provider');
		expect(target.searchParams.get('from')).toBe('/console');
		expect(backend).not.toHaveBeenCalled();
	});
});
