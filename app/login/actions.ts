/**
 * @author Claude
 * @version 2.1
 * @date 2026/9/15 13:42:12
 *
 * Server actions for the /login page.
 *
 * setLoginCookies — writes OAuth2 state and redirect target into HttpOnly
 * cookies, then returns the generated state and the first-party Ham Web
 * client id so the caller can build the deep-link URL. Called from the
 * client right before launching the app.
 */
'use server';

import { cookies } from 'next/headers';

import { setLoginCookies as setLoginFlowCookies } from '@/services/login-flow';

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
	const state = setLoginFlowCookies(cookieStore, from);
	return { state, clientId: process.env.CONSOLE_CLIENT_ID ?? '' };
};
