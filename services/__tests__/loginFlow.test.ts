/**
 * Unit tests for setLoginCookies — the SameSite policy of the OAuth
 * state and destination cookies.
 *
 * The state cookie is what guards the callback against CSRF, so a
 * SameSite value that the browser withholds makes the stored state
 * unreadable and every login of that provider fail closed with
 * "Invalid login state". Conversely, relaxing it to None for
 * providers that do not need it widens CSRF exposure for no reason.
 */
import { describe, expect, it, vi } from 'vitest';

import { FROM_COOKIE, STATE_COOKIE } from '@/services/cookies';
import { setLoginCookies } from '@/services/login-flow';

type SetCall = [string, string, { sameSite: 'lax' | 'none'; secure: boolean }];

const collectCalls = () => {
	const calls: SetCall[] = [];
	const cookies = {
		set: (name: string, value: string, options: SetCall[2]) => {
			calls.push([name, value, options]);
		},
	};
	return { calls, cookies };
};

const sameSiteOf = (calls: SetCall[], name: string) =>
	calls.filter(([n]) => n === name).map(([, , o]) => o.sameSite);

describe('setLoginCookies', () => {
	it('uses Lax by default', () => {
		const { calls, cookies } = collectCalls();
		setLoginCookies(cookies, '/console');

		expect(sameSiteOf(calls, STATE_COOKIE)).toEqual(['lax']);
		expect(sameSiteOf(calls, FROM_COOKIE)).toEqual(['lax']);
	});

	it('uses Lax when crossSiteCallback is false', () => {
		const { calls, cookies } = collectCalls();
		setLoginCookies(cookies, '/console', { crossSiteCallback: false });

		expect(sameSiteOf(calls, STATE_COOKIE)).toEqual(['lax']);
		expect(sameSiteOf(calls, FROM_COOKIE)).toEqual(['lax']);
	});

	// Apple posts its callback cross-site (response_mode=form_post), so a
	// Lax cookie would not be sent and the state check would always fail.
	it('uses None for a cross-site callback', () => {
		const { calls, cookies } = collectCalls();
		setLoginCookies(cookies, '/console', { crossSiteCallback: true });

		expect(sameSiteOf(calls, STATE_COOKIE)).toEqual(['none']);
		expect(sameSiteOf(calls, FROM_COOKIE)).toEqual(['none']);
	});

	it('keeps the cookies Secure so None remains valid', () => {
		const { calls, cookies } = collectCalls();
		setLoginCookies(cookies, '/console', { crossSiteCallback: true });

		// SameSite=None without Secure is rejected by modern browsers.
		const insecure = calls.filter(([, , o]) => !o.secure);
		expect(insecure).toEqual([]);
	});

	it('applies the SameSite policy to both cookies', () => {
		const { calls, cookies } = collectCalls();
		setLoginCookies(cookies, '/console', { crossSiteCallback: true });

		const state = calls.filter(([n]) => n === STATE_COOKIE);
		const from = calls.filter(([n]) => n === FROM_COOKIE);
		expect(state).toHaveLength(1);
		expect(from).toHaveLength(1);
		expect(from[0][1]).toBe('/console');
	});

	it('returns a unique state on each call', () => {
		const { cookies } = collectCalls();
		const first = setLoginCookies(cookies, '/console');
		const second = setLoginCookies(cookies, '/console');

		expect(first).toBeTruthy();
		expect(first).not.toBe(second);
	});

	it('stores the returned state in the state cookie', () => {
		const { calls, cookies } = collectCalls();
		const state = setLoginCookies(cookies, '/console');

		const stored = calls.find(([n]) => n === STATE_COOKIE);
		expect(stored?.[1]).toBe(state);
	});

	it('does not depend on call order for the SameSite decision', () => {
		const spy = vi.fn();
		const cookies = { set: spy };

		setLoginCookies(cookies, '/a', { crossSiteCallback: true });
		setLoginCookies(cookies, '/b', { crossSiteCallback: false });

		const options = spy.mock.calls.map((c) => (c as SetCall)[2].sameSite);
		expect(options).toEqual(['none', 'none', 'lax', 'lax']);
	});
});
