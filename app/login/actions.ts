/**
 * @author Claude
 * @version 2.0
 * @date 2026/9/10 18:55:06
 *
 * Server actions for the /login page.
 *
 * setLoginCookies — writes OAuth2 state and redirect target into HttpOnly
 * cookies, then returns the generated state so the caller can build the
 * deep-link URL. Called from the client right before launching the app.
 */
'use server';

import { cookies } from 'next/headers';

import { setLoginCookies as setLoginFlowCookies } from '@/services/login-flow';

export const setLoginCookies = async (from: string): Promise<string> => {
	const cookieStore = await cookies();
	return setLoginFlowCookies(cookieStore, from);
};
