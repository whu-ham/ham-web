/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/15 01:06:40
 *
 * Starts a browser OAuth login: /login/oauth/{provider}?from=...
 *
 * Validates the provider, stores the CSRF state and the return
 * destination in HttpOnly cookies, then redirects to the provider's
 * authorization endpoint. Rejects an unknown provider rather than
 * falling through, so a typo cannot reach the upstream host.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { safeRedirect } from '@/services/redirect';
import {
	buildLoginOAuthCallbackUrl,
	getOAuthProviderConfig,
	isOAuthProvider,
} from '@/services/oauth-providers';
import { setLoginCookies } from '@/services/login-flow';

const loginErrorRedirect = (
	req: NextRequest,
	from: string | null | undefined,
	error: string
) => {
	const url = new URL('/login', req.url);
	url.searchParams.set('from', safeRedirect(from, '/console'));
	url.searchParams.set('error', error);
	return NextResponse.redirect(url);
};

export const GET = async (
	req: NextRequest,
	{ params }: { params: Promise<{ provider: string }> }
) => {
	const { provider } = await params;
	if (!isOAuthProvider(provider)) {
		return loginErrorRedirect(
			req,
			req.nextUrl.searchParams.get('from'),
			'Unsupported provider'
		);
	}

	const config = getOAuthProviderConfig(provider);
	if (!config) {
		return loginErrorRedirect(
			req,
			req.nextUrl.searchParams.get('from'),
			'Unsupported provider'
		);
	}

	const from = safeRedirect(req.nextUrl.searchParams.get('from'), '/console');
	const cookieStore = await cookies();
	const state = setLoginCookies(cookieStore, from, {
		crossSiteCallback: config.crossSiteCallback,
	});
	const callbackUrl = buildLoginOAuthCallbackUrl(req.nextUrl.origin, provider);
	const authorizeUrl = config.buildAuthorizeUrl({
		callbackUrl,
		state,
	});

	return NextResponse.redirect(authorizeUrl);
};
