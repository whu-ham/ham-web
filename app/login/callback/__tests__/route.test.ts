/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:55:00
 *
 * Unit tests for /login/callback — the mobile app deep-link callback.
 *
 * The app launches this URL after its own authorize round-trip, so the
 * handler is the last gate before a session exists. The tests pin:
 *
 * - the state check against the app-login cookie. The app and the browser
 *   OAuth flow are both open on /login, which is why this flow keeps its
 *   own cookie pair.
 * - the code exchange and the session cookies it returns, which have to
 *   ride back on the redirect or the user lands on /console logged out.
 * - the two different clean-ups: a state failure keeps the destination so
 *   the user can retry, while a failed exchange drops it as well.
 *
 * Each rejection carries its own `error` and never the backend text: the
 * value travels in the redirect URL and is shown to the user, while a
 * backend message can name internals.
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

vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

import { GET } from '@/app/login/callback/route';
import { APP_FROM_COOKIE, APP_STATE_COOKIE } from '@/services/cookies';

const ORIGIN = 'https://ham.example.com';

const callbackRequest = (query: string) =>
	new NextRequest(new Request(`${ORIGIN}/login/callback${query}`));

/** Stub the app-callback exchange. Defaults to a successful, cookieless reply. */
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

const redirectTo = (res: Response) =>
	new URL(String(res.headers.get('location')));

const setCookies = (res: Response) => res.headers.getSetCookie?.() ?? [];

/** Whether a `Set-Cookie` entry expires `name` (value emptied, epoch date). */
const expiresCookie = (res: Response, name: string) =>
	setCookies(res).some(
		(cookie) => cookie.startsWith(`${name}=;`) && cookie.includes('1970')
	);

const jar = new Map<string, string>();

describe('GET /login/callback', () => {
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

	it('exchanges the code and replays the backend session cookies', async () => {
		jar.set(APP_STATE_COOKIE, 'st-1');
		jar.set(APP_FROM_COOKIE, '/console/tokens');
		const backend = stubBackend({
			setCookies: [
				'ham_session=sess-1; Path=/; HttpOnly',
				'ham_refresh=ref-1; Path=/; HttpOnly',
			],
		});

		const res = await GET(callbackRequest('?code=code-1&state=st-1'));

		const [url, init] = backend.mock.calls.at(-1) as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe('http://localhost:8080/web/auth/app-callback');
		expect(init.method).toBe('POST');
		// Only the code is forwarded: the state was already checked here.
		expect(JSON.parse(String(init.body))).toEqual({ code: 'code-1' });

		expect(res.status).toBe(307);
		expect(redirectTo(res).pathname).toBe('/console/tokens');
		expect(setCookies(res)).toContain('ham_session=sess-1; Path=/; HttpOnly');
		expect(setCookies(res)).toContain('ham_refresh=ref-1; Path=/; HttpOnly');
		// Both one-time cookies are spent.
		expect(expiresCookie(res, APP_STATE_COOKIE)).toBe(true);
		expect(expiresCookie(res, APP_FROM_COOKIE)).toBe(true);
	});

	it('returns to /console when no destination was stored', async () => {
		jar.set(APP_STATE_COOKIE, 'st-1');
		stubBackend({ setCookies: ['ham_session=sess-1; Path=/'] });

		const res = await GET(callbackRequest('?code=code-1&state=st-1'));

		expect(redirectTo(res).pathname).toBe('/console');
	});

	// The stored destination is later fed to the redirect, so a value that
	// was tampered with in the jar must still not become an open redirect.
	it('ignores a stored destination on a host that is not allowed', async () => {
		jar.set(APP_STATE_COOKIE, 'st-1');
		jar.set(APP_FROM_COOKIE, 'https://evil.example.com/x');
		stubBackend();

		const res = await GET(callbackRequest('?code=code-1&state=st-1'));

		expect(redirectTo(res).origin).toBe(ORIGIN);
		expect(redirectTo(res).pathname).toBe('/console');
	});

	it('refuses a callback with no code', async () => {
		jar.set(APP_STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await GET(callbackRequest('?state=st-1'));

		expect(redirectTo(res).searchParams.get('error')).toBe(
			'missing_code_or_state'
		);
		expect(backend).not.toHaveBeenCalled();
	});

	it('refuses a callback with no state', async () => {
		jar.set(APP_STATE_COOKIE, 'st-1');
		const backend = stubBackend();

		const res = await GET(callbackRequest('?code=code-1'));

		expect(redirectTo(res).searchParams.get('error')).toBe(
			'missing_code_or_state'
		);
		expect(backend).not.toHaveBeenCalled();
	});

	// A missing cookie means the app was launched from a page that never
	// stored one — or that a browser OAuth prefetch overwrote the pair.
	it('refuses a callback that arrives with no stored state', async () => {
		const backend = stubBackend();

		const res = await GET(callbackRequest('?code=code-1&state=st-1'));

		const target = redirectTo(res);
		expect(target.pathname).toBe('/login');
		expect(target.searchParams.get('error')).toBe('state_cookie_missing');
		expect(backend).not.toHaveBeenCalled();
		// The destination is kept so the user can retry from where they were.
		expect(expiresCookie(res, APP_STATE_COOKIE)).toBe(true);
		expect(expiresCookie(res, APP_FROM_COOKIE)).toBe(false);
	});

	it('refuses a state that does not match the stored one', async () => {
		jar.set(APP_STATE_COOKIE, 'st-1');
		jar.set(APP_FROM_COOKIE, '/console/tokens');
		const backend = stubBackend();

		const res = await GET(callbackRequest('?code=code-1&state=forged'));

		const target = redirectTo(res);
		expect(target.searchParams.get('error')).toBe('state_mismatch');
		expect(backend).not.toHaveBeenCalled();
		expect(expiresCookie(res, APP_STATE_COOKIE)).toBe(true);
		expect(expiresCookie(res, APP_FROM_COOKIE)).toBe(false);
	});

	// The backend message is logged, not shown: ?error= is rendered to the
	// user and the envelope can name internals.
	it('reports a rejected exchange without the backend text', async () => {
		jar.set(APP_STATE_COOKIE, 'st-1');
		jar.set(APP_FROM_COOKIE, '/console');
		const backend = stubBackend({
			status: 401,
			body: JSON.stringify({
				code: '11001',
				message: 'redis 10.0.0.7 refused',
			}),
		});

		const res = await GET(callbackRequest('?code=code-1&state=st-1'));

		const target = redirectTo(res);
		expect(target.pathname).toBe('/login');
		expect(target.searchParams.get('error')).toBe('app_callback_failed');
		expect(String(target)).not.toContain('10.0.0.7');
		expect(backend).toHaveBeenCalledTimes(1);
		// A failed exchange drops the destination as well: retrying means
		// restarting the login, not resuming a stale target.
		expect(expiresCookie(res, APP_STATE_COOKIE)).toBe(true);
		expect(expiresCookie(res, APP_FROM_COOKIE)).toBe(true);
	});

	it('reports an unreachable backend without the transport error', async () => {
		jar.set(APP_STATE_COOKIE, 'st-1');
		jar.set(APP_FROM_COOKIE, '/console/tokens');
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('connect ECONNREFUSED 10.0.0.7:8080');
			})
		);

		const res = await GET(callbackRequest('?code=code-1&state=st-1'));

		const target = redirectTo(res);
		expect(target.searchParams.get('error')).toBe('app_callback_failed');
		expect(String(target)).not.toContain('10.0.0.7');
		expect(expiresCookie(res, APP_FROM_COOKIE)).toBe(true);
		expect(console.error).toHaveBeenCalled();
	});
});
