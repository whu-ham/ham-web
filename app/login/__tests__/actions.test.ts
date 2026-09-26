/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 21:00:00
 *
 * Unit tests for the /login server action that arms the app deep-link login.
 *
 * A server action is a public endpoint: anything the browser passes can
 * reach it, not just what the login page renders. Two things follow, and
 * the tests pin both:
 *
 * - the destination is validated before it is stored, because /login/callback
 *   redirects to whatever this action wrote. An unvalidated value would
 *   turn the login into an open redirect.
 * - the state goes into the app-login cookie pair, never the browser OAuth
 *   pair. /login renders the provider links next to the "Open App" button
 *   and next/link prefetches those links, so a shared cookie let every
 *   prefetch wipe the state of an app login that had just been armed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cookieStore } = vi.hoisted(() => ({
	cookieStore: {
		get: vi.fn(),
		getAll: vi.fn(() => []),
		set: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

import { setLoginCookies } from '@/app/login/actions';
import {
	APP_FROM_COOKIE,
	APP_STATE_COOKIE,
	FROM_COOKIE,
	STATE_COOKIE,
} from '@/services/cookies';

/** The cookies the action wrote, keyed by name. */
const writtenCookies = () =>
	Object.fromEntries(
		cookieStore.set.mock.calls.map((call) => {
			const [name, value, options] = call as unknown as [
				string,
				string,
				Record<string, unknown>,
			];
			return [name, { value, options }];
		})
	) as Record<string, { value: string; options: Record<string, unknown> }>;

describe('setLoginCookies (login action)', () => {
	beforeEach(() => {
		cookieStore.get.mockReturnValue(undefined);
		cookieStore.getAll.mockReturnValue([]);
		cookieStore.set.mockClear();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('stores the state and destination and returns the state', async () => {
		const result = await setLoginCookies('/console/tokens');

		const cookies = writtenCookies();
		expect(cookies[APP_STATE_COOKIE]?.value).toBe(result.state);
		expect(result.state).toBeTruthy();
		expect(cookies[APP_FROM_COOKIE]?.value).toBe('/console/tokens');
		for (const name of [APP_STATE_COOKIE, APP_FROM_COOKIE]) {
			expect(cookies[name]?.options.httpOnly).toBe(true);
			expect(cookies[name]?.options.secure).toBe(true);
		}
	});

	// Regression guard: the OAuth provider links on /login are prefetched,
	// and each prefetch mints a fresh state into the browser pair. Writing
	// there would invalidate this login before the app ever called back.
	it('writes the app pair, never the browser OAuth pair', async () => {
		await setLoginCookies('/console');

		const names = cookieStore.set.mock.calls.map(
			(call) => (call as unknown as [string])[0]
		);
		expect(names).toEqual([APP_STATE_COOKIE, APP_FROM_COOKIE]);
		expect(names).not.toContain(STATE_COOKIE);
		expect(names).not.toContain(FROM_COOKIE);
	});

	// Whatever is stored here is what /login/callback redirects to.
	it('sanitises the destination before storing it', async () => {
		await setLoginCookies('https://evil.example.com/steal');

		expect(writtenCookies()[APP_FROM_COOKIE]?.value).toBe('/console');
	});

	it('falls back to /console when no destination is given', async () => {
		await setLoginCookies('');

		expect(writtenCookies()[APP_FROM_COOKIE]?.value).toBe('/console');
	});

	it('returns the configured client id for the deep link', async () => {
		vi.stubEnv('CONSOLE_CLIENT_ID', 'ham-web-console');

		const result = await setLoginCookies('/console');

		expect(result.clientId).toBe('ham-web-console');
	});

	// The app builds its authorize URL from this value; an empty string
	// lets the caller skip the deep link instead of sending `client_id=undefined`.
	it('returns an empty client id when none is configured', async () => {
		vi.stubEnv('CONSOLE_CLIENT_ID', undefined);

		const result = await setLoginCookies('/console');

		expect(result.clientId).toBe('');
	});
});
