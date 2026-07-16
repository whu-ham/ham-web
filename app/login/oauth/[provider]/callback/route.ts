import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { safeRedirect } from '@/services/redirect';
import { serverFetch } from '@/services/server-fetch';
import {
	buildLoginOAuthCallbackPath,
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
		const form = await req.formData();
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

const buildQQRecoveryHtml = (actionUrl: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>Ham Login</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b1020;
        color: #f5f7fb;
      }
      .card {
        width: min(92vw, 420px);
        padding: 24px;
        border-radius: 20px;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.12);
        box-shadow: 0 18px 60px rgba(0,0,0,.28);
      }
      .title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
      .desc { margin: 0; color: rgba(245,247,251,.72); line-height: 1.6; }
      .error { margin-top: 14px; color: #ffd2d2; font-size: 14px; }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1 class="title">Completing QQ sign-in</h1>
      <p class="desc">We are finishing the QQ login flow. If this page does not advance, please go back and try again.</p>
      <p id="error" class="error" hidden></p>
      <form id="qq-form" action="${actionUrl}" method="post">
        <input type="hidden" name="access_token" value="" />
        <input type="hidden" name="openid" value="" />
        <input type="hidden" name="state" value="" />
        <span class="sr-only">Submitting login data</span>
      </form>
    </main>
    <script>
      (function () {
        const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        const search = new URLSearchParams(window.location.search);
        const accessToken = hash.get('access_token') || search.get('access_token') || '';
        const openid = hash.get('openid') || search.get('openid') || '';
        const state = hash.get('state') || search.get('state') || '';
        const error = hash.get('error_description') || hash.get('error') || search.get('error') || '';
        const form = document.getElementById('qq-form');
        const errorNode = document.getElementById('error');

        if (!accessToken) {
          errorNode.hidden = false;
          errorNode.textContent = 'QQ did not return an access token.';
          return;
        }

        form.querySelector('input[name="access_token"]').value = accessToken;
        form.querySelector('input[name="openid"]').value = openid;
        form.querySelector('input[name="state"]').value = state;

        if (error) {
          errorNode.hidden = false;
          errorNode.textContent = error;
        }

        form.submit();
      })();
    </script>
  </body>
</html>`;

const finishOAuthLogin = async (
	req: NextRequest,
	provider: OAuthProvider,
	payload: OAuthCallbackPayload
) => {
	const cookieStore = await cookies();
	const storedState = cookieStore.get(LOGIN_FLOW_COOKIE_NAMES.state)?.value;
	const storedFrom = cookieStore.get(LOGIN_FLOW_COOKIE_NAMES.from)?.value;

	if (!storedState || storedState !== payload.state) {
		clearLoginCookies(cookieStore);
		return loginErrorRedirect(req, storedFrom, 'Invalid login state');
	}

	const backendPath = `/web/auth/oauth/${provider}/callback`;
	let response: Response;
	let errorMessage: string | undefined;

	try {
		const result = await serverFetch(backendPath, {
			method: 'POST',
			body: JSON.stringify(payload),
		});
		response = result.response;
		errorMessage = result.errorEnvelope.message;
	} catch (e) {
		clearLoginCookies(cookieStore);
		return loginErrorRedirect(
			req,
			storedFrom,
			e instanceof Error ? e.message : 'Network error'
		);
	}

	if (!response.ok) {
		clearLoginCookies(cookieStore);
		return loginErrorRedirect(
			req,
			storedFrom,
			errorMessage || `HTTP ${response.status}`
		);
	}

	const res = NextResponse.redirect(
		new URL(safeRedirect(storedFrom, '/console'), req.url)
	);
	clearLoginCookies(res.cookies);
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
		if (provider === 'qq') {
			const actionUrl = `${req.nextUrl.origin}${buildLoginOAuthCallbackPath(provider)}`;
			return new NextResponse(buildQQRecoveryHtml(actionUrl), {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'no-store',
				},
			});
		}

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
