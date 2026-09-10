/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 13:06:00
 *
 * Mobile deep-link handoff on /sso-authorize.
 *
 * The branch is chosen from the User-Agent: on mobile the page first
 * tries `ham://` and, if the app does not take focus, falls back to an
 * in-browser screen. The `mobile-chromium` project supplies the iPhone
 * user agent that selects this branch, so the whole file is skipped on
 * desktop.
 *
 * The handoff itself cannot succeed headlessly — no handler is installed
 * for `ham://` — so after the probe timeout the page settles on the
 * fallback (or straight into consent when already signed in). Those
 * settled states are what these specs assert.
 */
import { expect, test } from '../fixtures/index.ts';
import { SsoAuthorizePage } from '../pages/index.ts';
import { REDIRECT_URI } from '../fixtures/data.ts';

// File scoping lives in playwright.config.ts: only the mobile-chromium
// project matches this file, and only it sets an iPhone UA.

test.describe('sso authorize — mobile deep link', () => {
	test('falls back to the install prompt when the app is absent', async ({
		anonPage,
	}) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
			state: 'xyz',
		});

		// The probe screen shows first, then the fallback once it times out.
		await expect(sso.fallbackTitle).toBeVisible({ timeout: 15_000 });
		await expect(sso.downloadButton).toBeVisible();
	});

	test('offers passkey sign-in on the anonymous fallback', async ({
		anonPage,
	}) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.fallbackTitle).toBeVisible({ timeout: 15_000 });
		await expect(
			anonPage.getByRole('button', { name: 'Sign in with passkey' })
		).toBeVisible();
	});

	test('reaches consent in-browser once signed in', async ({ authedPage }) => {
		// An authenticated mobile user skips the login fallback entirely
		// when the deep link does not launch.
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.appName).toBeVisible({ timeout: 15_000 });
		await expect(sso.authorizeButton).toBeVisible();
	});
});
