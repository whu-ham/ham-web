/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/10 16:10:00
 *
 * The mobile branch of /sso-authorize.
 *
 * Mobile takes a different path from desktop: instead of bouncing
 * straight to /login, the page first probes `ham://` and only falls back
 * to an in-browser screen when the App does not take focus. That
 * fallback then differs by auth state — signed-in users get a route back
 * to consent, anonymous users get the install prompt plus Passkey.
 *
 * The `mobile-chromium` project supplies the iPhone user agent that
 * selects this branch, and playwright.config.ts scopes this file to it.
 *
 * The handoff itself cannot succeed headlessly — no handler is installed
 * for `ham://` — so every spec asserts the state the page settles on
 * after the probe times out.
 */
import { expect, test } from '../fixtures/index.ts';
import { setupStub } from '../stub/control.ts';
import { SsoAuthorizePage } from '../pages/index.ts';
import { REDIRECT_URI } from '../fixtures/data.ts';

/** The deep-link probe gives up after ~1.5s; allow slack under load. */
const PROBE_TIMEOUT = 15_000;

test.describe('sso authorize — mobile fallback', () => {
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
		await expect(sso.fallbackTitle).toBeVisible({ timeout: PROBE_TIMEOUT });
		await expect(sso.downloadButton).toBeVisible();
		await expect(
			anonPage.getByText('The app may not be installed')
		).toBeVisible();
	});

	test('shows the App Store link for an iPhone user agent', async ({
		anonPage,
	}) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.fallbackTitle).toBeVisible({ timeout: PROBE_TIMEOUT });
		// getAppStoreURL branches on deviceKind, and iOS is what the
		// spoofed UA resolves to.
		await expect(sso.downloadButton).toContainText('App Store');
	});

	test('offers a way to retry the deep link', async ({ anonPage }) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.fallbackTitle).toBeVisible({ timeout: PROBE_TIMEOUT });
		await expect(
			anonPage.getByText('Already installed, reopen Ham')
		).toBeVisible();
	});

	test('offers passkey sign-in to an anonymous visitor', async ({
		anonPage,
	}) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.fallbackTitle).toBeVisible({ timeout: PROBE_TIMEOUT });
		await expect(
			anonPage.getByRole('button', { name: 'Sign in with passkey' })
		).toBeVisible();
		// The QR flow is desktop-only, so it must not appear here.
		await expect(anonPage.getByText('Scan the QR code')).toHaveCount(0);
	});

	test('sends a signed-in visitor straight to consent', async ({
		authedPage,
	}) => {
		// A signed-in mobile user never sees the install fallback: the
		// deep link is only a shortcut, so once the probe fails the page
		// goes directly to consent.
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.appName).toBeVisible({ timeout: PROBE_TIMEOUT });
		await expect(sso.authorizeButton).toBeVisible();
		await expect(sso.fallbackTitle).toHaveCount(0);
		// Passkey is only offered to anonymous visitors.
		await expect(
			authedPage.getByRole('button', { name: 'Sign in with passkey' })
		).toHaveCount(0);
	});

	test('signed-in consent lists the requested scopes', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
		});

		await expect(sso.appName).toBeVisible({ timeout: PROBE_TIMEOUT });
		await expect(
			authedPage.getByText('Identity', { exact: true })
		).toBeVisible();
		await expect(authedPage.getByText('MCP', { exact: true })).toBeVisible();
	});

	test('signed-in mobile visitor can complete the authorization', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
			state: 'xyz',
		});

		await expect(sso.authorizeButton).toBeVisible({ timeout: PROBE_TIMEOUT });
		await sso.authorizeButton.click();

		await authedPage.waitForURL(/example\.com\/callback/, {
			timeout: 10_000,
		});
		const url = new URL(authedPage.url());
		expect(url.searchParams.get('code')).toBe('stub-auth-code');
		expect(url.searchParams.get('state')).toBe('xyz');
	});

	test('anonymous browser sign-in keeps the whole authorize request', async ({
		anonPage,
	}) => {
		// The anonymous fallback's Passkey path never completes headlessly,
		// so this asserts the request is preserved for the flows that can.
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
			state: 'xyz',
		});

		await expect(sso.fallbackTitle).toBeVisible({ timeout: PROBE_TIMEOUT });
		// The authorize request stays in the URL so any sign-in route can
		// resume it without the user starting over.
		expect(new URL(anonPage.url()).searchParams.get('client_id')).toBe(
			'stub-app'
		);
		expect(new URL(anonPage.url()).searchParams.get('state')).toBe('xyz');
	});

	test('still rejects an invalid request on mobile', async ({ anonPage }) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({ clientId: 'stub-app' });

		// Parameter validation runs server-side, before any deep-link branch.
		await expect(sso.invalidTitle).toBeVisible();
	});

	test('shows the consent error view on mobile when details fail', async ({
		authedPage,
	}) => {
		await setupStub({ consentInfoFails: true });

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.errorTitle).toBeVisible({ timeout: PROBE_TIMEOUT });
	});
});
