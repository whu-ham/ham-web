/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the `ham://` deep-link launcher.
 *
 * There is no API that says "an app handled this URL", so the outcome is
 * inferred: the tab being backgrounded means the App took focus, and a
 * timeout with the tab still visible means nothing claimed the scheme.
 * The synchronous-throw case matters too — some webviews raise on an
 * unknown scheme instead of ignoring it, and the caller must be able to
 * skip straight to the "App not installed" screen.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
	buildSsoAuthorizeDeepLink,
	tryLaunchDeepLink,
} from '@/services/sso/deepLink';

const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');

const setHidden = (hidden: boolean) => {
	Object.defineProperty(document, 'hidden', {
		configurable: true,
		get: () => hidden,
	});
};

// jsdom logs "Not implemented: navigation" for a plain
// `window.location.href = ...`, so location is replaced by a recorder the
// tests can assert on instead.
const defineLocation = (onAssign: (url: string) => void) => {
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: {
			set href(value: string) {
				onAssign(value);
			},
			get href() {
				return 'https://ham.example.com/login';
			},
		},
	});
};

describe('tryLaunchDeepLink', () => {
	afterEach(() => {
		setHidden(false);
		if (originalLocation) {
			Object.defineProperty(window, 'location', originalLocation);
		}
	});

	it('reports a launch when the tab is backgrounded', async () => {
		const assigned: string[] = [];
		defineLocation((url) => assigned.push(url));
		setHidden(true);

		// No explicit timeout: the default has to apply, and the promise
		// must still settle on the visibility change rather than after it.
		const launched = tryLaunchDeepLink({
			url: 'ham://sso-authorize?state=1',
		});
		document.dispatchEvent(new Event('visibilitychange'));

		await expect(launched).resolves.toEqual({ launched: true });
		expect(assigned).toEqual(['ham://sso-authorize?state=1']);
	});

	it('reports no launch when the tab stays visible until the timeout', async () => {
		const assigned: string[] = [];
		defineLocation((url) => assigned.push(url));
		setHidden(false);

		await expect(
			tryLaunchDeepLink({ url: 'ham://sso-authorize', timeoutMs: 0 })
		).resolves.toEqual({ launched: false });
		expect(assigned).toEqual(['ham://sso-authorize']);
	});

	// A visibility change that leaves the tab visible is not the App
	// taking focus, so the wait must continue.
	it('ignores a visibility change that leaves the tab visible', async () => {
		defineLocation(() => undefined);
		setHidden(false);

		const launched = tryLaunchDeepLink({
			url: 'ham://sso-authorize',
			timeoutMs: 0,
		});
		document.dispatchEvent(new Event('visibilitychange'));

		await expect(launched).resolves.toEqual({ launched: false });
	});

	// Some in-app webviews throw on an unhandled scheme instead of
	// ignoring it. That is a definitive "not installed" answer, so the
	// caller must not sit out the timeout first.
	it('reports a failure when the navigation throws synchronously', async () => {
		defineLocation(() => {
			throw new Error('unhandled scheme');
		});
		setHidden(false);

		await expect(
			tryLaunchDeepLink({ url: 'ham://sso-authorize', timeoutMs: 10000 })
		).resolves.toEqual({ launched: false, failed: true });
	});

	// The first answer wins. A webview can background the tab (the App did
	// open) and still raise on the scheme; reporting `failed` on top of an
	// observed launch would send the user to the "not installed" screen
	// while the App is already in front of them.
	it('lets an observed launch win over a later navigation error', async () => {
		setHidden(true);
		defineLocation(() => {
			document.dispatchEvent(new Event('visibilitychange'));
			throw new Error('unhandled scheme');
		});

		await expect(
			tryLaunchDeepLink({ url: 'ham://sso-authorize', timeoutMs: 10000 })
		).resolves.toEqual({ launched: true });
	});

	// The pending timeout outlives a settled launch. It has to notice that
	// and back off rather than reporting "not launched" after the fact.
	it('ignores the timeout once the App has already taken focus', async () => {
		defineLocation(() => undefined);
		setHidden(true);

		const launched = tryLaunchDeepLink({
			url: 'ham://sso-authorize',
			timeoutMs: 20,
		});
		document.dispatchEvent(new Event('visibilitychange'));

		await expect(launched).resolves.toEqual({ launched: true });
		await new Promise((resolve) => setTimeout(resolve, 60));
		await expect(launched).resolves.toEqual({ launched: true });
	});
});

describe('buildSsoAuthorizeDeepLink', () => {
	it('mirrors the authorize query the App expects', () => {
		expect(
			buildSsoAuthorizeDeepLink({
				appId: 'app_1',
				scope: ['openid', 'profile'],
				state: 'st_1',
				redirectUri: 'https://app.example.com/cb',
			})
		).toBe(
			'ham://sso-authorize?client_id=app_1&scope=openid+profile&state=st_1' +
				'&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb'
		);
	});

	// A consent screen with every scope unchecked is a legitimate
	// selection, and it must not be sent as an empty `scope=`.
	it('omits the scope when the selection is empty', () => {
		const url = buildSsoAuthorizeDeepLink({
			appId: 'app_1',
			scope: [],
			state: 'st_1',
			redirectUri: 'https://app.example.com/cb',
		});

		expect(url).not.toContain('scope=');
		expect(url).toBe(
			'ham://sso-authorize?client_id=app_1&state=st_1' +
				'&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb'
		);
	});

	it('omits the state when the caller has none', () => {
		const url = buildSsoAuthorizeDeepLink({
			appId: 'app_1',
			scope: ['openid'],
			state: '',
			redirectUri: 'https://app.example.com/cb',
		});

		expect(url).not.toContain('state=');
		expect(url).toContain('scope=openid');
	});

	it('encodes values that would otherwise break the query', () => {
		const url = buildSsoAuthorizeDeepLink({
			appId: 'app 1&x',
			scope: ['a b'],
			state: 'st&1',
			redirectUri: 'https://app.example.com/cb?a=1&b=2',
		});

		const query = new URL(url).searchParams;
		// Every value has to survive one decode round-trip unchanged, or
		// the App resumes the OAuth flow with a truncated redirect_uri.
		expect(query.get('client_id')).toBe('app 1&x');
		expect(query.get('scope')).toBe('a b');
		expect(query.get('state')).toBe('st&1');
		expect(query.get('redirect_uri')).toBe(
			'https://app.example.com/cb?a=1&b=2'
		);
	});
});
