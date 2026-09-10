/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/10 18:55:06
 *
 * Shared login-flow cookie handling.
 *
 * Writes the OAuth2 state and the post-login destination into HttpOnly
 * cookies so neither can be read or tampered with from the page. The
 * store interfaces keep this module independent of `next/headers`,
 * which is what lets it run under both server actions and route
 * handlers.
 */

import { FROM_COOKIE, STATE_COOKIE } from '@/services/cookies';

const LOGIN_COOKIE_MAX_AGE = 60 * 10;

export interface LoginCookieWriter {
	set(
		name: string,
		value: string,
		options: {
			httpOnly: boolean;
			secure: boolean;
			sameSite: 'lax' | 'none';
			path: string;
			maxAge: number;
		}
	): unknown;
}

export interface LoginCookieRead {
	get(name: string): { value: string } | undefined;
	delete(name: string): unknown;
}

export const createLoginState = (): string => crypto.randomUUID();

/**
 * Apple is the one provider configured with `response_mode=form_post`, so
 * its callback arrives as a cross-site POST. Browsers withhold `Lax`
 * cookies from those, which would leave the stored state unreadable and
 * fail every Apple login with "Invalid login state". `None` is what lets
 * the cookie ride along, and it is only ever paired with `Secure`.
 *
 * The other providers stay on `Lax`: GitHub returns through a top-level
 * GET, and the QQ fragment shim posts from our own origin, so neither is
 * a cross-site request.
 */
const sameSiteFor = (crossSiteCallback: boolean): 'lax' | 'none' =>
	crossSiteCallback ? 'none' : 'lax';

export const setLoginCookies = (
	cookies: LoginCookieWriter,
	from: string,
	{ crossSiteCallback = false }: { crossSiteCallback?: boolean } = {}
): string => {
	const state = createLoginState();
	const sameSite = sameSiteFor(crossSiteCallback);

	cookies.set(STATE_COOKIE, state, {
		httpOnly: true,
		secure: true,
		sameSite,
		path: '/',
		maxAge: LOGIN_COOKIE_MAX_AGE,
	});

	cookies.set(FROM_COOKIE, from, {
		httpOnly: true,
		secure: true,
		sameSite,
		path: '/',
		maxAge: LOGIN_COOKIE_MAX_AGE,
	});

	return state;
};

export const clearLoginCookies = (cookies: LoginCookieRead) => {
	cookies.delete(STATE_COOKIE);
	cookies.delete(FROM_COOKIE);
};

export const LOGIN_FLOW_COOKIE_NAMES = {
	state: STATE_COOKIE,
	from: FROM_COOKIE,
} as const;
