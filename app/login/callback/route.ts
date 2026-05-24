/**
 * OAuth2 callback route for mobile app login.
 *
 * This endpoint only validates state, exchanges the code for backend session
 * cookies, and redirects. It is a route handler instead of a page because
 * callback handling must mutate cookies, which is not allowed while rendering
 * a Server Component page.
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
		return loginRedirect(req);
	}

	const cookieStore = await cookies();
	const storedState = cookieStore.get(LOGIN_CALLBACK_COOKIES.state)?.value;
	if (!storedState || storedState !== state) {
		return loginRedirect(req);
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
		return loginRedirect(
			req,
			e instanceof Error ? e.message : 'Network error',
			true
		);
	}

	if (!response.ok) {
		return loginRedirect(req, errorMessage || `HTTP ${response.status}`, true);
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
