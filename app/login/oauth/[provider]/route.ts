import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { safeRedirect } from '@/services/redirect';
import {
	buildLoginOAuthCallbackPath,
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
	const state = setLoginCookies(cookieStore, from);
	const callbackUrl = `${req.nextUrl.origin}${buildLoginOAuthCallbackPath(
		provider
	)}`;
	const authorizeUrl = config.buildAuthorizeUrl({
		callbackUrl,
		state,
	});

	return NextResponse.redirect(authorizeUrl);
};
