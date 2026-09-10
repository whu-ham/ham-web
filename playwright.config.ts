/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:55:00
 *
 * Playwright configuration for the ham-web end-to-end suite.
 *
 * Bootstrapping happens in ordered stages, all managed by Playwright's
 * `webServer` list so the stub is guaranteed to be listening before Next
 * starts and both processes are reaped when the run ends:
 *   1. the backend stub (see e2e/stub),
 *   2. Next.js, built and served from a production artefact with
 *      HAM_BACKEND_ORIGIN pointed at that stub,
 *   3. fixtures, which reset stub state and inject the session cookie.
 *
 * Serving a production build rather than `next dev` keeps the suite
 * aligned with the artefact that actually ships.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

import { APP_ORIGIN, APP_PORT, STUB_ORIGIN } from './e2e/ports';

export { APP_ORIGIN, APP_PORT, STUB_ORIGIN };

const isCI = Boolean(process.env.CI);

/**
 * iPhone user agent used by the mobile project. The app's `detectDeviceKind`
 * reads the UA (plus `navigator.maxTouchPoints` for iPadOS), so spoofing it
 * on Chromium exercises the mobile branch without a WebKit install.
 */
const IPHONE_UA = {
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
		'(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
	isMobile: true,
	hasTouch: true,
	viewport: { width: 390, height: 844 },
	deviceScaleFactor: 3,
};

export default defineConfig({
	testDir: path.resolve(__dirname, 'e2e/specs'),
	// Specs share one stub backend, so state must not bleed between them.
	fullyParallel: false,
	workers: 1,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	reporter: isCI ? [['github'], ['list']] : [['list']],
	timeout: 30_000,
	expect: { timeout: 7_000 },

	use: {
		baseURL: APP_ORIGIN,
		// Pin the locale so i18n assertions do not depend on the host's
		// default language.
		locale: 'en-US',
		timezoneId: 'UTC',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'off',
	},

	projects: [
		{
			name: 'desktop-chromium',
			use: { ...devices['Desktop Chrome'] },
			// The deep-link branch is only reachable with a mobile UA and
			// lives in its own spec, run by the mobile project below.
			testIgnore: /sso-mobile\.spec\.ts/,
		},
		{
			name: 'mobile-chromium',
			// Chromium with an iPhone UA: the app picks its deep-link
			// branch from the User-Agent, not from the engine, so we get
			// mobile behaviour without installing WebKit.
			use: { ...devices['Desktop Chrome'], ...IPHONE_UA },
			testMatch: /sso-mobile\.spec\.ts/,
		},
	],

	webServer: [
		{
			// Must be first: Next's SSR calls the backend during build-time
			// prerendering and on every request.
			command: 'node e2e/stub/start.ts',
			url: `${STUB_ORIGIN}/__stub/state`,
			// Same reasoning as the app server below: a leftover process
			// can hold state or a build that the next run replaces.
			reuseExistingServer: false,
			timeout: 60_000,
			stdout: 'pipe',
			stderr: 'pipe',
		},
		{
			// Assumes the app is already built (`pnpm build`). Building here
			// would overwrite the .next of any server already listening on
			// this port, which then fails every request with a missing
			// client reference manifest.
			command: `pnpm start --port ${APP_PORT}`,
			url: APP_ORIGIN,
			// Never reuse: a leftover server may be serving a stale build,
			// and its held ports make runs interfere with each other. CI
			// already behaves this way; matching it locally keeps the two
			// consistent.
			reuseExistingServer: false,
			timeout: 300_000,
			stdout: 'pipe',
			stderr: 'pipe',
			env: {
				HAM_BACKEND_ORIGIN: STUB_ORIGIN,
				NEXT_PUBLIC_SITE_URL: APP_ORIGIN,
				// MSW stays off: the stub backend covers both SSR and BFF
				// calls, and its service worker would only add a second
				// source of truth for the same responses.
				NEXT_PUBLIC_ENABLE_MSW: 'false',
			},
		},
	],
});
