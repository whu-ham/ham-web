/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/18 16:56:23
 *
 * Unit tests for the shared login-flow cookie helpers.
 *
 * Covers the cookie attributes that decide whether a provider callback
 * can read the stored state: Apple posts back cross-site, so its state
 * cookie must be SameSite=None (paired with Secure), while the providers
 * that return through a top-level GET stay on Lax.
 *
 * Also pins the two flows to different cookie names. /login renders the
 * OAuth provider links next to the "Open App" button, and next/link
 * prefetches those links, so a shared name let each prefetch wipe the
 * state of an app login that had just started.
 */

import { describe, expect, it } from 'vitest';

import {
	APP_FROM_COOKIE,
	APP_STATE_COOKIE,
	FROM_COOKIE,
	STATE_COOKIE,
} from '@/services/cookies';
import {
	APP_LOGIN_COOKIE_NAMES,
	clearLoginCookies,
	createLoginState,
	LOGIN_FLOW_COOKIE_NAMES,
	setLoginCookies,
	type LoginCookieRead,
	type LoginCookieWriter,
} from '@/services/login-flow';

type SetCall = {
	name: string;
	value: string;
	options: Record<string, unknown>;
};

const createWriter = () => {
	const calls: SetCall[] = [];
	const writer: LoginCookieWriter = {
		set: (name, value, options) => {
			calls.push({ name, value, options });
			return undefined;
		},
	};
	return { calls, writer };
};

const createReader = () => {
	const deleted: string[] = [];
	const reader: LoginCookieRead = {
		get: () => undefined,
		delete: (name: string) => {
			deleted.push(name);
			return undefined;
		},
	};
	return { deleted, reader };
};

describe('createLoginState', () => {
	it('returns a non-empty unique value', () => {
		const a = createLoginState();
		const b = createLoginState();
		expect(a).toBeTruthy();
		expect(a).not.toBe(b);
	});
});

describe('setLoginCookies', () => {
	it('writes both state and from cookies and returns the state', () => {
		const { calls, writer } = createWriter();
		const state = setLoginCookies(writer, '/console');

		expect(state).toBeTruthy();
		expect(calls.map((c) => c.name)).toEqual([STATE_COOKIE, FROM_COOKIE]);
		expect(calls[0]?.value).toBe(state);
		expect(calls[1]?.value).toBe('/console');
	});

	it('marks cookies HttpOnly, Secure and Lax by default', () => {
		const { calls, writer } = createWriter();
		setLoginCookies(writer, '/console');

		for (const call of calls) {
			expect(call.options.httpOnly).toBe(true);
			expect(call.options.secure).toBe(true);
			expect(call.options.sameSite).toBe('lax');
			expect(call.options.path).toBe('/');
			expect(call.options.maxAge).toBeGreaterThan(0);
		}
	});

	// Apple's response_mode=form_post makes the callback a cross-site POST
	// from appleid.apple.com. Browsers withhold Lax cookies from those, so
	// the stored state would be unreadable and every Apple login would fail
	// with "Invalid login state".
	it('uses SameSite=None for a cross-site callback', () => {
		const { calls, writer } = createWriter();
		setLoginCookies(writer, '/console', { crossSiteCallback: true });

		expect(calls).toHaveLength(2);
		for (const call of calls) {
			expect(call.options.sameSite).toBe('none');
			// None is only valid alongside Secure.
			expect(call.options.secure).toBe(true);
		}
	});

	it('keeps Lax for same-site callbacks', () => {
		const { calls, writer } = createWriter();
		setLoginCookies(writer, '/console', { crossSiteCallback: false });

		for (const call of calls) {
			expect(call.options.sameSite).toBe('lax');
		}
	});

	it('writes to the cookie names it is given', () => {
		const { calls, writer } = createWriter();
		const state = setLoginCookies(writer, '/console', {
			names: APP_LOGIN_COOKIE_NAMES,
		});

		expect(calls.map((c) => c.name)).toEqual([
			APP_STATE_COOKIE,
			APP_FROM_COOKIE,
		]);
		expect(calls[0]?.value).toBe(state);
		expect(calls[1]?.value).toBe('/console');
	});
});

describe('clearLoginCookies', () => {
	it('deletes both state and from cookies', () => {
		const { deleted, reader } = createReader();
		clearLoginCookies(reader);

		expect(deleted).toEqual([STATE_COOKIE, FROM_COOKIE]);
	});

	it('deletes the cookie names it is given', () => {
		const { deleted, reader } = createReader();
		clearLoginCookies(reader, APP_LOGIN_COOKIE_NAMES);

		expect(deleted).toEqual([APP_STATE_COOKIE, APP_FROM_COOKIE]);
	});
});

describe('login flow cookie names', () => {
	it('exposes the shared cookie names', () => {
		expect(LOGIN_FLOW_COOKIE_NAMES.state).toBe(STATE_COOKIE);
		expect(LOGIN_FLOW_COOKIE_NAMES.from).toBe(FROM_COOKIE);
	});

	// Regression guard: the browser OAuth links on /login are prefetched by
	// next/link, and each prefetch mints a fresh state. Sharing a cookie
	// name would let those prefetches invalidate an app login that the
	// user had already started, failing it with a silent state mismatch.
	it('gives the app login its own cookies, disjoint from the OAuth ones', () => {
		const oauthNames = Object.values(LOGIN_FLOW_COOKIE_NAMES);
		const appNames = Object.values(APP_LOGIN_COOKIE_NAMES);

		expect(appNames).toEqual([APP_STATE_COOKIE, APP_FROM_COOKIE]);
		for (const name of appNames) {
			expect(oauthNames).not.toContain(name);
		}
	});
});
