/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 15:40:00
 *
 * The OAuth2 app-callback route at /login/callback.
 *
 * This is where the mobile App hands the user back after sign-in: the
 * route validates the OAuth2 `state` against the cookie written before
 * the deep link fired, exchanges the code for a session, then redirects
 * to the original target. It is a route handler rather than a page
 * because it must mutate cookies.
 *
 * The interesting behaviour is the rejection paths — a mismatched or
 * missing state must not be exchanged, and a failed exchange must land
 * on /login with the reason attached rather than silently signing the
 * user in.
 */
import { expect, test } from '../fixtures/index.ts';
import { setupStub } from '../stub/control.ts';
import { REDIRECT_URI, VALID_SESSION } from '../fixtures/data.ts';

/**
 * Host the app is served from. Next normalises redirect targets to this
 * host, so cookies must be set on it or they are dropped on redirect —
 * see the note on APP_ORIGIN in playwright.config.ts.
 */
const APP_HOST = 'localhost';

/** Cookie holding the OAuth2 state, written before the deep link fires. */
const STATE_COOKIE = 'ham_login_state';

/** Cookie holding the post-login redirect target. */
const FROM_COOKIE = 'ham_login_from';

/**
 * A plain (non-HttpOnly) login-flow cookie on the app origin.
 * These are written by a server action, so they are readable by JS —
 * unlike the session cookie, which is HttpOnly.
 */
const loginCookie = (name: string, value: string) => ({
	name,
	value,
	domain: APP_HOST,
	path: '/',
});

/** Build a /login/callback URL with the given code and state. */
const callbackUrl = (code?: string, state?: string): string => {
	const search = new URLSearchParams();
	if (code !== undefined) search.set('code', code);
	if (state !== undefined) search.set('state', state);
	return `/login/callback?${search.toString()}`;
};

test.describe('app callback', () => {
	test('exchanges a valid code and redirects to the stored target', async ({
		anonPage,
	}) => {
		await setupStub();
		await anonPage
			.context()
			.addCookies([
				loginCookie(STATE_COOKIE, 'state-123'),
				loginCookie(FROM_COOKIE, '/console/tokens'),
			]);

		await anonPage.goto(callbackUrl('good-code', 'state-123'));

		await expect(anonPage).toHaveURL(/\/console\/tokens$/);
		const cookies = await anonPage.context().cookies();
		expect(cookies.find((c) => c.name === 'ham_session')?.value).toBe(
			VALID_SESSION
		);
	});

	test('falls back to the console when no target was stored', async ({
		anonPage,
	}) => {
		await setupStub();
		await anonPage
			.context()
			.addCookies([loginCookie(STATE_COOKIE, 'state-123')]);

		await anonPage.goto(callbackUrl('good-code', 'state-123'));

		await expect(anonPage).toHaveURL(/\/console$/);
	});

	test('rejects a mismatched state', async ({ anonPage }) => {
		await setupStub();
		await anonPage
			.context()
			.addCookies([
				loginCookie(STATE_COOKIE, 'state-123'),
				loginCookie(FROM_COOKIE, '/console/tokens'),
			]);

		await anonPage.goto(callbackUrl('good-code', 'state-WRONG'));

		await expect(anonPage).toHaveURL(/\/login/);
		// A rejected exchange must not issue a session.
		const cookies = await anonPage.context().cookies();
		expect(cookies.find((c) => c.name === 'ham_session')).toBeUndefined();
	});

	test('rejects a callback with no stored state', async ({ anonPage }) => {
		await setupStub();

		await anonPage.goto(callbackUrl('good-code', 'state-123'));

		await expect(anonPage).toHaveURL(/\/login/);
	});

	test('rejects a callback missing the code or state parameter', async ({
		anonPage,
	}) => {
		await setupStub();

		await anonPage.goto(callbackUrl(undefined, 'state-123'));
		await expect(anonPage).toHaveURL(/\/login/);

		await anonPage.goto(callbackUrl('good-code', undefined));
		await expect(anonPage).toHaveURL(/\/login/);
	});

	test('surfaces the reason when the exchange fails', async ({ anonPage }) => {
		// The stub rejects this specific code, mirroring a backend that
		// refuses an already-used or expired authorization code.
		await setupStub({ appCallbackFails: true });
		await anonPage
			.context()
			.addCookies([
				loginCookie(STATE_COOKIE, 'state-123'),
				loginCookie(FROM_COOKIE, '/console/tokens'),
			]);

		await anonPage.goto(callbackUrl('good-code', 'state-123'));

		await expect(anonPage).toHaveURL(/\/login\?/);
		expect(new URL(anonPage.url()).searchParams.get('error')).toBeTruthy();
		// The stored target is cleared so the user is not bounced back into
		// a loop against a code the backend already refused.
		const cookies = await anonPage.context().cookies();
		expect(cookies.find((c) => c.name === FROM_COOKIE)?.value ?? '').toBe('');
	});

	test('ignores an absolute redirect target outside the allow-list', async ({
		anonPage,
	}) => {
		await setupStub();
		await anonPage
			.context()
			.addCookies([
				loginCookie(STATE_COOKIE, 'state-123'),
				loginCookie(FROM_COOKIE, 'https://evil.example.com/steal'),
			]);

		await anonPage.goto(callbackUrl('good-code', 'state-123'));

		// Open-redirect guard: the unsafe target is dropped for /console.
		await expect(anonPage).toHaveURL(/\/console$/);
	});

	test('keeps a same-origin absolute target for the authorize flow', async ({
		anonPage,
	}) => {
		await setupStub();
		await anonPage
			.context()
			.addCookies([
				loginCookie(STATE_COOKIE, 'state-123'),
				loginCookie(
					FROM_COOKIE,
					`/sso-authorize?client_id=stub-app&redirect_uri=${encodeURIComponent(
						REDIRECT_URI
					)}`
				),
			]);

		await anonPage.goto(callbackUrl('good-code', 'state-123'));

		await expect(anonPage).toHaveURL(/\/sso-authorize\?client_id=stub-app/);
	});
});
