/**
 * @author Claude
 * @version 1.2
 * @date 2026/9/23 01:53:07
 *
 * OAuth2 callback route for mobile app login.
 *
 * This endpoint only validates state, exchanges the code for backend session
 * cookies, and redirects. It is a route handler instead of a page because
 * callback handling must mutate cookies, which is not allowed while rendering
 * a Server Component page.
 *
 * Every rejection carries a distinct `error` so a failed app login says why
 * on the login page instead of bouncing back in silence.
 *
 * The codes are stable identifiers, never backend text. Whatever
 * lands in `?error=` is shown to the user, and the backend message can
 * carry internals — including a missing-env diagnostic.
 */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { safeRedirect } from '@/services/redirect';
import { serverFetch } from '@/services/server-fetch';
import {
	APP_CALLBACK_BACKEND_PATH,
	getBackendSetCookies,
	LOGIN_CALLBACK_COOKIES,
} from '@/services/login-callback';

const loginRedirect = (
	req: NextRequest,
	error?: string,
	clearFrom = false
): NextResponse => {
	const url = new URL('/login', req.url);
	if (error) url.searchParams.set('error', error);

	const res = NextResponse.redirect(url);
	res.cookies.delete(LOGIN_CALLBACK_COOKIES.state);
	if (clearFrom) res.cookies.delete(LOGIN_CALLBACK_COOKIES.from);
	return res;
};

export const GET = async (req: NextRequest) => {
	const code = req.nextUrl.searchParams.get('code');
	const state = req.nextUrl.searchParams.get('state');
	if (!code || !state) {
		return loginRedirect(req, 'missing_code_or_state');
	}

	const cookieStore = await cookies();
	const storedState = cookieStore.get(LOGIN_CALLBACK_COOKIES.state)?.value;
	if (!storedState) {
		return loginRedirect(req, 'state_cookie_missing');
	}
	if (storedState !== state) {
		return loginRedirect(req, 'state_mismatch');
	}

	let response: Response;
	let errorMessage: string | undefined;
	try {
		const result = await serverFetch(APP_CALLBACK_BACKEND_PATH, {
			method: 'POST',
			body: JSON.stringify({ code }),
		});
		response = result.response;
		errorMessage = result.errorEnvelope.message;
	} catch (e) {
		// The message is logged, not shown: it can name internals.
		console.error('[login/callback] app callback failed', e);
		return loginRedirect(req, 'app_callback_failed', true);
	}

	if (!response.ok) {
		console.error(
			'[login/callback] app callback rejected',
			response.status,
			errorMessage
		);
		return loginRedirect(req, 'app_callback_failed', true);
	}

	const storedFrom = cookieStore.get(LOGIN_CALLBACK_COOKIES.from)?.value;
	const res = NextResponse.redirect(new URL(safeRedirect(storedFrom), req.url));

	res.cookies.delete(LOGIN_CALLBACK_COOKIES.state);
	res.cookies.delete(LOGIN_CALLBACK_COOKIES.from);
	for (const setCookie of getBackendSetCookies(response)) {
		res.headers.append('Set-Cookie', setCookie);
	}

	return res;
};
