/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/26 20:50:00
 *
 * Unit tests for the browser OAuth start endpoint, /login/oauth/{provider}.
 *
 * This handler mints the CSRF state the callback is later verified
 * against, so two behaviours matter more than the redirect itself:
 *
 *   1. A next/link prefetch must not run the flow. Prefetches are
 *      speculative and repeat constantly; each one used to rotate the
 *      state cookie and invalidate a login the user had already started.
 *   2. The state cookie has to survive Apple's callback, which arrives
 *      as a cross-site POST — browsers withhold `SameSite=Lax` cookies
 *      from those, so this provider needs `None`.
 *
 * The `from` value is attacker-controlled and is what /login/callback
 * later redirects to, so it is pinned to the sanitised form.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STATE_COOKIE, FROM_COOKIE } from '@/services/cookies';
import { OAUTH_PROVIDER_CONFIGS } from '@/services/oauth-providers';

interface RecordedCookie {
	name: string;
	value: string;
	options?: Record<string, unknown>;
}

const jar = new Map<string, string>();
const written: RecordedCookie[] = [];

const cookieStore = {
	get: (name: string) => {
		const value = jar.get(name);
		return value === undefined ? undefined : { name, value };
	},
	set: (name: string, value: string, options?: Record<string, unknown>) => {
		written.push({ name, value, options });
		jar.set(name, value);
	},
	delete: (name: string) => {
		jar.delete(name);
	},
	getAll: () => [...jar].map(([name, value]) => ({ name, value })),
};

vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

import { GET } from '@/app/login/oauth/[provider]/route';

const ORIGIN = 'https://ham.example.com';

const start = (
	provider: string,
	search = '',
	headers: Record<string, string> = {}
) =>
	GET(
		new NextRequest(
			new Request(`${ORIGIN}/login/oauth/${provider}${search}`, { headers })
		),
		{ params: Promise.resolve({ provider }) }
	);

const cookie = (name: string) => written.find((c) => c.name === name);

const locationOf = (res: Response) =>
	new URL(res.headers.get('location') ?? '');

describe('GET /login/oauth/{provider}', () => {
	beforeEach(() => {
		jar.clear();
		written.length = 0;
		vi.stubEnv('GITHUB_CLIENT_ID', 'gh-client');
		vi.stubEnv('APPLE_CLIENT_ID', 'apple-client');
	});

	it('refuses to run for a next/link prefetch', async () => {
		const res = await start('github', '?from=%2Fconsole', {
			'Next-Router-Prefetch': '1',
		});

		// A prefetch that minted a state would invalidate the login the
		// user may already have in flight on the same page.
		expect(res.status).toBe(204);
		expect(written).toHaveLength(0);
	});

	it('rejects an unknown provider instead of reaching an upstream host', async () => {
		const res = await start('myspace', '?from=%2Fconsole');

		const url = locationOf(res);
		expect(url.pathname).toBe('/login');
		expect(url.searchParams.get('error')).toBe('Unsupported provider');
		expect(written).toHaveLength(0);
	});

	it('sanitises an open-redirect `from` before rejecting', async () => {
		const res = await start('myspace', '?from=%2F%2Fevil.example.com');

		const url = locationOf(res);
		expect(url.searchParams.get('from')).toBe('/console');
	});

	it('redirects to the provider authorize endpoint with a derived callback', async () => {
		const res = await start('github', '?from=%2Fconsole%2Ftokens');

		const url = locationOf(res);
		expect(`${url.origin}${url.pathname}`).toBe(
			'https://github.com/login/oauth/authorize'
		);
		expect(url.searchParams.get('client_id')).toBe('gh-client');
		expect(url.searchParams.get('redirect_uri')).toBe(
			`${ORIGIN}/login/oauth/github/callback`
		);
		expect(url.searchParams.get('scope')).toBe('read:user');
	});

	it('stores the minted state and the sanitised destination', async () => {
		await start('github', '?from=%2Fconsole%2Ftokens');

		const state = cookie(STATE_COOKIE);
		const from = cookie(FROM_COOKIE);

		expect(state?.value).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
		);
		expect(from?.value).toBe('/console/tokens');
		// HttpOnly keeps the CSRF state out of reach of the page.
		expect(state?.options?.httpOnly).toBe(true);
		expect(state?.options?.secure).toBe(true);
		expect(state?.options?.sameSite).toBe('lax');
	});

	it('echoes the minted state into the authorize URL', async () => {
		const res = await start('github', '?from=%2Fconsole');

		const url = locationOf(res);
		expect(url.searchParams.get('state')).toBe(cookie(STATE_COOKIE)?.value);
	});

	it('downgrades an unsafe `from` to the console before storing it', async () => {
		await start('github', '?from=https%3A%2F%2Fevil.example.com%2Fx');

		expect(cookie(FROM_COOKIE)?.value).toBe('/console');
	});

	it('downgrades a protocol-relative `from` as well', async () => {
		await start('github', '?from=%2F%2Fevil.example.com');

		expect(cookie(FROM_COOKIE)?.value).toBe('/console');
	});

	it('falls back to the console when no destination is given', async () => {
		await start('github');

		expect(cookie(FROM_COOKIE)?.value).toBe('/console');
	});

	it('relaxes the state cookie for Apple, whose callback is a cross-site POST', async () => {
		const res = await start('apple', '?from=%2Fconsole');

		const url = locationOf(res);
		expect(url.searchParams.get('response_mode')).toBe('form_post');
		// Browsers drop `Lax` cookies from Apple's form_post callback, which
		// would leave the stored state unreadable.
		expect(cookie(STATE_COOKIE)?.options?.sameSite).toBe('none');
		expect(cookie(FROM_COOKIE)?.options?.sameSite).toBe('none');
	});

	// The provider id list and the config registry are two separate tables,
	// so an id can exist without an entry behind it. That has to be refused
	// rather than fall through to an unconfigured authorize request.
	it('rejects a known provider id that has no config entry', async () => {
		const registry = OAUTH_PROVIDER_CONFIGS as unknown as Record<
			string,
			unknown
		>;
		const saved = registry.github;
		Reflect.deleteProperty(registry, 'github');
		try {
			const res = await start('github', '?from=%2Fconsole');

			const url = locationOf(res);
			expect(url.pathname).toBe('/login');
			expect(url.searchParams.get('error')).toBe('Unsupported provider');
			expect(written).toHaveLength(0);
		} finally {
			registry.github = saved;
		}
	});
});
