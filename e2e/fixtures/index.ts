/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:56:00
 *
 * Playwright fixtures for the ham-web e2e suite.
 *
 * Two page fixtures are provided:
 *   - `anonPage`   — browser context with no session cookie
 *   - `authedPage` — browser context carrying a valid session cookie
 *
 * The session is injected as a cookie rather than obtained by driving the
 * real login (QR polling / WebAuthn), because both require either the
 * native app or a platform authenticator that a headless browser cannot
 * provide. Cookie injection still exercises the full SSR guard:
 * `requireAuth` reads the forwarded cookie and only the backend's verdict
 * decides whether the page renders or redirects.
 *
 * Backend state is reset in a `beforeEach` hook rather than in a lazy
 * fixture, because Playwright only instantiates a fixture when a test
 * destructures it — a spec that seeds nothing would otherwise inherit the
 * previous test's rows and failure switches.
 */
import { test as base, expect, type Page } from '@playwright/test';

import { resetStub } from '../stub/control.ts';
import { SESSION_COOKIE, VALID_SESSION } from './data.ts';

/** Port the app is served from; see playwright.config.ts. */
const APP_PORT = 3210;

export const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;

interface Fixtures {
	/** Page in a context with no session cookie. */
	anonPage: Page;
	/** Page in a context carrying a valid session cookie. */
	authedPage: Page;
}

export const test = base.extend<Fixtures>({
	anonPage: async ({ browser }, use) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await use(page);
		await context.close();
	},

	authedPage: async ({ browser }, use) => {
		const context = await browser.newContext();
		await context.addCookies([
			{
				name: SESSION_COOKIE,
				value: VALID_SESSION,
				domain: '127.0.0.1',
				path: '/',
				httpOnly: true,
				sameSite: 'Lax',
				// httpOnly cookies may not be `secure` over plain HTTP.
				secure: false,
			},
		]);
		const page = await context.newPage();
		await use(page);
		await context.close();
	},
});

// Belt-and-braces reset: specs arrange their own state through
// `setupStub`, which resets atomically, but a clean default matters for
// the ones that seed nothing at all.
test.beforeEach(async () => {
	await resetStub();
});

export { expect };
