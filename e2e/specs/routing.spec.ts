/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:58:00
 *
 * Routing and SSR auth-guard behaviour.
 *
 * These cover the `requireAuth` / `fetchMe` seam: the guard must send
 * anonymous visitors to /login with a usable `from` parameter, and let
 * sessions through. Everything here is decided server-side, so the specs
 * assert on the URL the browser ends up at.
 */
import { expect, test } from '../fixtures/index.ts';
import { sessionCookie, VALID_SESSION } from '../fixtures/data.ts';

test.describe('routing and auth guard', () => {
	test('root redirects to the console', async ({ anonPage }) => {
		await anonPage.goto('/');
		// Anonymous, so the console guard bounces us on to /login.
		await expect(anonPage).toHaveURL(/\/login/);
	});

	test('anonymous visit to /console redirects to /login with from', async ({
		anonPage,
	}) => {
		await anonPage.goto('/console');
		await expect(anonPage).toHaveURL(/\/login\?from=%2Fconsole/);
	});

	test('anonymous visit to /console/tokens redirects with from', async ({
		anonPage,
	}) => {
		await anonPage.goto('/console/tokens');
		await expect(anonPage).toHaveURL(/\/login\?from=%2Fconsole%2Ftokens/);
	});

	test('authenticated visit to /console renders the console', async ({
		authedPage,
	}) => {
		await authedPage.goto('/console');
		await expect(authedPage).toHaveURL(/\/console$/);
		await expect(authedPage.getByRole('heading', { level: 1 })).toContainText(
			'E2E User'
		);
	});

	test('authenticated visit to /login redirects back to console', async ({
		authedPage,
	}) => {
		await authedPage.goto('/login');
		await expect(authedPage).toHaveURL(/\/console$/);
	});

	test('authenticated visit to /login honours the from parameter', async ({
		authedPage,
	}) => {
		await authedPage.goto('/login?from=%2Fconsole%2Ftokens');
		await expect(authedPage).toHaveURL(/\/console\/tokens$/);
	});

	test('invalid session cookie is treated as anonymous', async ({
		browser,
	}) => {
		const context = await browser.newContext();
		await context.addCookies([sessionCookie('not-a-real-session')]);
		const page = await context.newPage();
		await page.goto('/console');
		await expect(page).toHaveURL(/\/login\?from=%2Fconsole/);
		await context.close();
	});

	test('login round-trips back to the originally requested page', async ({
		anonPage,
	}) => {
		// Land on a protected page, get bounced to /login with `from`.
		await anonPage.goto('/console/tokens');
		await expect(anonPage).toHaveURL(/\/login\?from=%2Fconsole%2Ftokens/);

		// Simulate the session the backend would set after a real login.
		const context = anonPage.context();
		await context.addCookies([sessionCookie(VALID_SESSION)]);

		// Reloading /login now redirects to the `from` target.
		await anonPage.reload();
		await expect(anonPage).toHaveURL(/\/console\/tokens$/);
	});
});
