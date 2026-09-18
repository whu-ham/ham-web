/**
 * @author Claude
 * @version 1.3
 * @date 2026/9/18 18:08:58
 *
 * Starts a browser OAuth login: /login/oauth/{provider}?from=...
 *
 * Validates the provider, stores the CSRF state and the return
 * destination in HttpOnly cookies, then redirects to the provider's
 * authorization endpoint. Rejects an unknown provider rather than
 * falling through, so a typo cannot reach the upstream host.
 *
 * Minting a state is a side effect, so this handler refuses to run for
 * next/link prefetches. A prefetch that reaches it rotates the state
 * cookie and silently invalidates any login already in flight on the
 * same page — which is exactly how the mobile app login was failing.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { safeRedirect } from '@/services/redirect';
import {
	buildLoginOAuthCallbackUrl,
	getOAuthProviderConfig,
	isOAuthProvider,
} from '@/services/oauth-providers';
import {
	LOGIN_FLOW_COOKIE_NAMES,
	setLoginCookies,
} from '@/services/login-flow';

/**
 * next/link prefetches its targets in production and marks those requests
 * with `Next-Router-Prefetch: 1`. A real navigation carries `RSC: 1` but
 * never the prefetch marker.
 */
const isPrefetchRequest = (req: NextRequest): boolean =>
	req.headers.get('next-router-prefetch') === '1';

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
	// Nothing useful to prefetch here, and running the flow would rotate
	// the CSRF state of a login the user may already have started.
	if (isPrefetchRequest(req)) {
		return new Response(null, { status: 204 });
	}

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
	// Name the pair explicitly even though it is the default: the app
	// deep-link login uses a different pair, and this flow has to keep
	// reading what it writes regardless of what the default becomes.
	const state = setLoginCookies(cookieStore, from, {
		crossSiteCallback: config.crossSiteCallback,
		names: LOGIN_FLOW_COOKIE_NAMES,
	});
	const callbackUrl = buildLoginOAuthCallbackUrl(req.nextUrl.origin, provider);
	const authorizeUrl = config.buildAuthorizeUrl({
		callbackUrl,
		state,
	});

	return NextResponse.redirect(authorizeUrl);
};
