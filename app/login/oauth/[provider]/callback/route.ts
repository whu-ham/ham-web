/**
 * @author Claude
 * @version 1.3
 * @date 2026/9/18 18:08:58
 *
 * Completes a browser OAuth login: /login/oauth/{provider}/callback
 *
 * Verifies the returned state against the stored cookie before
 * exchanging the credential, forwards it to the backend, and replays the
 * session cookies the backend issues.
 *
 * Reads and clears the browser OAuth cookie pair explicitly rather than
 * relying on the shared default: the mobile app deep-link login keeps a
 * separate pair, and this flow must keep reading what its start endpoint
 * writes whatever the default becomes.
 *
 * Every provider now returns an authorization code in the query string,
 * so the callback is a plain server-side exchange. The redirect_uri is
 * rebuilt here rather than taken from the request: providers compare it
 * against the one used to request the code and reject a mismatch, so a
 * client-supplied value would only be a way to break the exchange.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { safeRedirect } from '@/services/redirect';
import { serverFetch } from '@/services/server-fetch';
import {
	buildLoginOAuthCallbackUrl,
	isOAuthProvider,
	type OAuthProvider,
} from '@/services/oauth-providers';
import {
	clearLoginCookies,
	LOGIN_FLOW_COOKIE_NAMES,
} from '@/services/login-flow';
import { getBackendSetCookies } from '@/services/login-callback';

type OAuthCallbackPayload = {
	code?: string;
	access_token?: string;
	identity_token?: string;
	id_token?: string;
	openid?: string;
	state?: string;
};

const loginErrorRedirect = (
	req: NextRequest,
	from: string | undefined,
	error: string
) => {
	const url = new URL('/login', req.url);
	url.searchParams.set('from', safeRedirect(from, '/console'));
	url.searchParams.set('error', error);
	return NextResponse.redirect(url);
};

const readBodyPayload = async (
	req: NextRequest
): Promise<OAuthCallbackPayload> => {
	const contentType = req.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		const body = (await req.json().catch(() => ({}))) as OAuthCallbackPayload;
		return body;
	}

	if (
		contentType.includes('multipart/form-data') ||
		contentType.includes('application/x-www-form-urlencoded')
	) {
		// A malformed or truncated body makes formData() throw, which would
		// otherwise surface as an unhandled 500. Treat an unparseable body
		// the same as an empty one so the caller gets the normal
		// "Missing login payload" redirect instead.
		const form = await req.formData().catch(() => null);
		if (!form) {
			return {};
		}
		return {
			code: form.get('code')?.toString() || undefined,
			access_token: form.get('access_token')?.toString() || undefined,
			identity_token: form.get('identity_token')?.toString() || undefined,
			id_token: form.get('id_token')?.toString() || undefined,
			openid: form.get('openid')?.toString() || undefined,
			state: form.get('state')?.toString() || undefined,
		};
	}

	return {};
};

const readQueryPayload = (req: NextRequest): OAuthCallbackPayload => ({
	code: req.nextUrl.searchParams.get('code') ?? undefined,
	access_token: req.nextUrl.searchParams.get('access_token') ?? undefined,
	identity_token: req.nextUrl.searchParams.get('identity_token') ?? undefined,
	id_token: req.nextUrl.searchParams.get('id_token') ?? undefined,
	openid: req.nextUrl.searchParams.get('openid') ?? undefined,
	state: req.nextUrl.searchParams.get('state') ?? undefined,
});

const getPayloadToken = (payload: OAuthCallbackPayload): string | undefined =>
	payload.identity_token || payload.id_token || payload.access_token;

const finishOAuthLogin = async (
	req: NextRequest,
	provider: OAuthProvider,
	payload: OAuthCallbackPayload
) => {
	const cookieStore = await cookies();
	const storedState = cookieStore.get(LOGIN_FLOW_COOKIE_NAMES.state)?.value;
	const storedFrom = cookieStore.get(LOGIN_FLOW_COOKIE_NAMES.from)?.value;

	if (!storedState || storedState !== payload.state) {
		clearLoginCookies(cookieStore, LOGIN_FLOW_COOKIE_NAMES);
		return loginErrorRedirect(req, storedFrom, 'Invalid login state');
	}

	const backendPath = `/web/auth/oauth/${provider}/callback`;
	let response: Response;
	let errorMessage: string | undefined;

	try {
		const result = await serverFetch(backendPath, {
			method: 'POST',
			// redirect_uri is derived, never taken from the request: it has to
			// match the value sent to the authorization endpoint, and letting
			// a caller supply it would only let them break their own exchange
			// — or probe the backend with arbitrary URIs.
			body: JSON.stringify({
				...payload,
				redirect_uri: buildLoginOAuthCallbackUrl(req.nextUrl.origin, provider),
			}),
		});
		response = result.response;
		errorMessage = result.errorEnvelope.message;
	} catch (e) {
		clearLoginCookies(cookieStore, LOGIN_FLOW_COOKIE_NAMES);
		return loginErrorRedirect(
			req,
			storedFrom,
			e instanceof Error ? e.message : 'Network error'
		);
	}

	if (!response.ok) {
		clearLoginCookies(cookieStore, LOGIN_FLOW_COOKIE_NAMES);
		return loginErrorRedirect(
			req,
			storedFrom,
			errorMessage || `HTTP ${response.status}`
		);
	}

	const res = NextResponse.redirect(
		new URL(safeRedirect(storedFrom, '/console'), req.url)
	);
	clearLoginCookies(res.cookies, LOGIN_FLOW_COOKIE_NAMES);
	for (const setCookie of getBackendSetCookies(response)) {
		res.headers.append('Set-Cookie', setCookie);
	}
	return res;
};

export const GET = async (
	req: NextRequest,
	{ params }: { params: Promise<{ provider: string }> }
) => {
	const { provider } = await params;
	if (!isOAuthProvider(provider)) {
		return loginErrorRedirect(
			req,
			req.nextUrl.searchParams.get('from') ?? undefined,
			'Unsupported provider'
		);
	}

	const payload = readQueryPayload(req);
	if (!payload.code && !getPayloadToken(payload)) {
		return loginErrorRedirect(
			req,
			req.nextUrl.searchParams.get('from') ?? undefined,
			'Missing login payload'
		);
	}

	return finishOAuthLogin(req, provider, payload);
};

export const POST = async (
	req: NextRequest,
	{ params }: { params: Promise<{ provider: string }> }
) => {
	const { provider } = await params;
	if (!isOAuthProvider(provider)) {
		return loginErrorRedirect(
			req,
			req.nextUrl.searchParams.get('from') ?? undefined,
			'Unsupported provider'
		);
	}

	const payload = {
		...readQueryPayload(req),
		...(await readBodyPayload(req)),
	};

	const token = getPayloadToken(payload);
	if (!payload.code && !token) {
		return loginErrorRedirect(
			req,
			req.nextUrl.searchParams.get('from') ?? undefined,
			'Missing login payload'
		);
	}

	return finishOAuthLogin(req, provider, payload);
};
