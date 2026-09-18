/**
 * @author Claude
 * @version 1.3
 * @date 2026/9/18 16:56:23
 *
 * Shared login-flow cookie handling.
 *
 * Writes the OAuth2 state and the post-login destination into HttpOnly
 * cookies so neither can be read or tampered with from the page. The
 * store interfaces keep this module independent of `next/headers`,
 * which is what lets it run under both server actions and route
 * handlers.
 *
 * Two flows share this module and each gets its own cookie pair (see
 * `LOGIN_FLOW_COOKIE_NAMES` / `APP_LOGIN_COOKIE_NAMES`). They must stay
 * separate: both are reachable from /login at the same time, so a shared
 * cookie lets one flow overwrite the other's pending CSRF state.
 */

import {
	APP_FROM_COOKIE,
	APP_STATE_COOKIE,
	FROM_COOKIE,
	STATE_COOKIE,
} from '@/services/cookies';

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
 * The other providers stay on `Lax`: every provider returns through a
 * top-level GET, so none of them is a cross-site request.
 */
const sameSiteFor = (crossSiteCallback: boolean): 'lax' | 'none' =>
	crossSiteCallback ? 'none' : 'lax';

/** The cookie pair a login flow stores its CSRF state and destination in. */
export interface LoginCookieNames {
	state: string;
	from: string;
}

interface SetLoginCookieOptions {
	crossSiteCallback?: boolean;
	names?: LoginCookieNames;
}

export const setLoginCookies = (
	cookies: LoginCookieWriter,
	from: string,
	{
		crossSiteCallback = false,
		names = LOGIN_FLOW_COOKIE_NAMES,
	}: SetLoginCookieOptions = {}
): string => {
	const state = createLoginState();
	const sameSite = sameSiteFor(crossSiteCallback);

	cookies.set(names.state, state, {
		httpOnly: true,
		secure: true,
		sameSite,
		path: '/',
		maxAge: LOGIN_COOKIE_MAX_AGE,
	});

	cookies.set(names.from, from, {
		httpOnly: true,
		secure: true,
		sameSite,
		path: '/',
		maxAge: LOGIN_COOKIE_MAX_AGE,
	});

	return state;
};

export const clearLoginCookies = (
	cookies: LoginCookieRead,
	names: LoginCookieNames = LOGIN_FLOW_COOKIE_NAMES
) => {
	cookies.delete(names.state);
	cookies.delete(names.from);
};

/** Cookie pair for browser OAuth logins (/login/oauth/{provider}). */
export const LOGIN_FLOW_COOKIE_NAMES: LoginCookieNames = {
	state: STATE_COOKIE,
	from: FROM_COOKIE,
};

/** Cookie pair for the mobile app deep-link login (/login/callback). */
export const APP_LOGIN_COOKIE_NAMES: LoginCookieNames = {
	state: APP_STATE_COOKIE,
	from: APP_FROM_COOKIE,
};
