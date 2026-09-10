/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 20:30:00
 *
 * Unit tests for the shared login-flow cookie helpers.
 *
 * Covers the cookie attributes that decide whether a provider callback
 * can read the stored state: Apple posts back cross-site, so its state
 * cookie must be SameSite=None (paired with Secure), while the providers
 * that return through a top-level GET stay on Lax.
 */

import { describe, expect, it } from 'vitest';

import { FROM_COOKIE, STATE_COOKIE } from '@/services/cookies';
import {
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
});

describe('clearLoginCookies', () => {
	it('deletes both state and from cookies', () => {
		const { deleted, reader } = createReader();
		clearLoginCookies(reader);

		expect(deleted).toEqual([STATE_COOKIE, FROM_COOKIE]);
	});
});

describe('LOGIN_FLOW_COOKIE_NAMES', () => {
	it('exposes the shared cookie names', () => {
		expect(LOGIN_FLOW_COOKIE_NAMES.state).toBe(STATE_COOKIE);
		expect(LOGIN_FLOW_COOKIE_NAMES.from).toBe(FROM_COOKIE);
	});
});
