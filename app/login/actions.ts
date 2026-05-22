/**
 * Server actions for the /login page.
 *
 * setLoginCookies — writes OAuth2 state and redirect target into HttpOnly
 * cookies, then returns the generated state so the caller can build the
 * deep-link URL. Called from the client right before launching the app.
 */
'use server';

import { cookies } from 'next/headers';

import { FROM_COOKIE, STATE_COOKIE } from '@/services/auth-cookies';

/** Cookie max-age: 10 minutes (enough for the app OAuth2 round-trip). */
const COOKIE_MAX_AGE = 60 * 10;

export const setLoginCookies = async (from: string): Promise<string> => {
	const state = crypto.randomUUID();
	const cookieStore = await cookies();

	cookieStore.set(STATE_COOKIE, state, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		maxAge: COOKIE_MAX_AGE,
	});

	cookieStore.set(FROM_COOKIE, from, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		maxAge: COOKIE_MAX_AGE,
	});

	return state;
};
