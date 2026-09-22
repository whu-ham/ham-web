/**
 * @author Claude
 * @version 2.3
 * @date 2026/9/23 00:32:19
 *
 * Server actions for the /login page.
 *
 * setLoginCookies — writes OAuth2 state and redirect target into HttpOnly
 * cookies, then returns the generated state and the first-party Ham Web
 * client id so the caller can build the deep-link URL. Called from the
 * client right before launching the app.
 *
 * Uses the app-login cookie pair rather than the browser OAuth one: the
 * OAuth provider links on /login are prefetched by next/link, and every
 * prefetch mints a fresh state, so sharing a cookie let those prefetches
 * invalidate the app login milliseconds after it started.
 *
 * `from` is validated before it is stored. A server action is a
 * public endpoint, so anything the browser passes — not just what the
 * login page renders — can reach this cookie, and the stored value is
 * what /login/callback redirects to.
 */
'use server';

import { cookies } from 'next/headers';

import {
	APP_LOGIN_COOKIE_NAMES,
	setLoginCookies as setLoginFlowCookies,
} from '@/services/login-flow';
import { safeRedirect } from '@/services/redirect';

export interface LoginCookiesResult {
	/** CSRF state bound to the current session, echoed back on the callback. */
	state: string;
	/**
	 * First-party Ham Web client id for the deep-link authorize request.
	 * Empty when CONSOLE_CLIENT_ID is not configured on the Worker.
	 */
	clientId: string;
}

export const setLoginCookies = async (
	from: string
): Promise<LoginCookiesResult> => {
	const cookieStore = await cookies();
	const state = setLoginFlowCookies(cookieStore, safeRedirect(from), {
		names: APP_LOGIN_COOKIE_NAMES,
	});
	return { state, clientId: process.env.CONSOLE_CLIENT_ID ?? '' };
};
