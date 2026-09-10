/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 16:30:00
 *
 * Behaviour when the backend stops accepting the session.
 *
 * A session can go stale while the browser still holds the cookie — the
 * server rotated its secret, the user revoked the grant elsewhere, or the
 * cookie simply outlived its TTL. Because the app's session cookie is
 * HttpOnly, the server is the only thing that can observe this, so every
 * page must react to the backend's verdict rather than to the cookie's
 * presence.
 *
 * Expiry is simulated by pointing the stub at a different valid session
 * value: the browser keeps sending its old cookie, which the backend now
 * rejects, exactly as a real expired credential behaves.
 */
import { expect, test } from '../fixtures/index.ts';
import { setupStub } from '../stub/control.ts';
import { REDIRECT_URI, VALID_SESSION } from '../fixtures/data.ts';
import { SsoAuthorizePage } from '../pages/index.ts';

/** Make the backend reject the session the fixtures injected. */
const expireSession = () => setupStub({ validSession: 'a-newer-session' });

test.describe('expired session', () => {
	test('sends an expired session from /console to /login', async ({
		authedPage,
	}) => {
		await expireSession();

		await authedPage.goto('/console');

		await expect(authedPage).toHaveURL(/\/login\?from=%2Fconsole/);
	});

	test('sends an expired session from /console/tokens to /login', async ({
		authedPage,
	}) => {
		await expireSession();

		await authedPage.goto('/console/tokens');

		await expect(authedPage).toHaveURL(/\/login\?from=%2Fconsole%2Ftokens/);
	});

	test('sends an expired session from /sso-authorize to /login', async ({
		authedPage,
	}) => {
		await expireSession();

		const sso = new SsoAuthorizePage(authedPage);
		await sso.gotoAndWaitFor(
			{
				clientId: 'stub-app',
				redirectUri: REDIRECT_URI,
				scope: 'identity',
			},
			/\/login\?from=%2Fsso-authorize/
		);

		await expect(authedPage).toHaveURL(/\/login\?from=%2Fsso-authorize/);
	});

	test('keeps the stale cookie rather than clearing it on redirect', async ({
		authedPage,
	}) => {
		// The session cookie is HttpOnly, so a redirect cannot remove
		// it — only an explicit logout can. Documenting this matters
		// because a stale cookie is what makes a retry loop possible.
		await expireSession();

		await authedPage.goto('/console');
		await expect(authedPage).toHaveURL(/\/login\?from=%2Fconsole/);

		const cookies = await authedPage.context().cookies();
		expect(cookies.find((c) => c.name === 'ham_session')?.value).toBe(
			VALID_SESSION
		);
	});

	test('recovers once the session is valid again', async ({ authedPage }) => {
		await expireSession();
		await authedPage.goto('/console');
		await expect(authedPage).toHaveURL(/\/login\?from=%2Fconsole/);

		// The backend starts honouring the session again, as it would after
		// the user completes a fresh sign-in.
		await setupStub({ validSession: VALID_SESSION });
		await authedPage.goto('/console');

		await expect(authedPage).toHaveURL(/\/console$/);
		await expect(authedPage.getByRole('heading', { level: 1 })).toContainText(
			'E2E User'
		);
	});

	test('does not expose a protected page to an expired session', async ({
		authedPage,
	}) => {
		await expireSession();

		await authedPage.goto('/console/tokens');

		// The redirect must happen before any protected content renders.
		await expect(authedPage.getByText('API Keys')).toHaveCount(0);
	});

	test('treats a backend failure on /me as an error, not as sign-out', async ({
		authedPage,
	}) => {
		// fetchMe deliberately distinguishes 5xx from 401: a broken
		// backend must not be reported as "you are logged out".
		await setupStub({ meFails: true });

		const response = await authedPage.goto('/console');

		// Either an error page surfaces or the request fails outright;
		// what must not happen is a confident redirect to /login.
		expect(response?.status() ?? 500).toBeGreaterThanOrEqual(400);
		expect(authedPage.url()).not.toMatch(/\/login\?from/);
	});
});
