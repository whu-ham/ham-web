/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/18 18:05:08
 *
 * EdgeOne Edge Function: GET /login/callback
 *
 * Mobile app OAuth2 callback handler for deployments where the callback path
 * is handled directly by EdgeOne. Mirrors the App Router route handler.
 *
 * Reads the app-login cookie pair, which is separate from the browser OAuth
 * pair: /login renders the OAuth provider links next to the "Open App"
 * button, so a shared cookie let OAuth activity invalidate an app login
 * that had already started.
 *
 * Every rejection carries a distinct `error` so a failed app login says
 * why on the login page instead of bouncing back in silence.
 */
import {
	APP_CALLBACK_BACKEND_PATH,
	expireLoginCookie,
	getBackendSetCookies,
	LOGIN_CALLBACK_COOKIES,
	parseAllowedRedirectHosts,
	readCookieFromHeader,
	safeRedirectWithAllowedHosts,
} from '../../services/login-callback';

const readCookie = (req: Request, name: string): string | undefined =>
	readCookieFromHeader(req.headers.get('cookie'), name);

const redirectToLogin = (
	req: Request,
	error?: string,
	clearFrom = false
): Response => {
	const url = new URL('/login', req.url);
	if (error) url.searchParams.set('error', error);

	const headers = new Headers({ Location: url.toString() });
	headers.append('Set-Cookie', expireLoginCookie(LOGIN_CALLBACK_COOKIES.state));
	if (clearFrom) {
		headers.append(
			'Set-Cookie',
			expireLoginCookie(LOGIN_CALLBACK_COOKIES.from)
		);
	}
	return new Response(null, { status: 302, headers });
};

const parseBackendError = async (
	res: Response
): Promise<string | undefined> => {
	try {
		const body = (await res.clone().json()) as unknown;
		if (
			typeof body === 'object' &&
			body !== null &&
			'message' in body &&
			typeof body.message === 'string'
		) {
			return body.message;
		}
	} catch {
		// Non-JSON error response.
	}
	return undefined;
};

export const onRequestGet = async (context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> => {
	const { request, env } = context;
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state) return redirectToLogin(request, 'missing_code_or_state');

	const storedState = readCookie(request, LOGIN_CALLBACK_COOKIES.state);
	if (!storedState) return redirectToLogin(request, 'state_cookie_missing');
	if (storedState !== state) return redirectToLogin(request, 'state_mismatch');

	let upstreamRes: Response;
	try {
		upstreamRes = await fetch(
			`${env.HAM_BACKEND_ORIGIN ?? ''}${APP_CALLBACK_BACKEND_PATH}`,
			{
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ code }),
			}
		);
	} catch (e) {
		return redirectToLogin(
			request,
			e instanceof Error ? e.message : 'Network error',
			true
		);
	}

	if (!upstreamRes.ok) {
		const message = await parseBackendError(upstreamRes);
		return redirectToLogin(
			request,
			message || `HTTP ${upstreamRes.status}`,
			true
		);
	}

	const location = new URL(
		safeRedirectWithAllowedHosts(
			readCookie(request, LOGIN_CALLBACK_COOKIES.from),
			parseAllowedRedirectHosts(env.NEXT_PUBLIC_ALLOWED_REDIRECT_HOSTS)
		),
		request.url
	);
	const headers = new Headers({ Location: location.toString() });
	headers.append('Set-Cookie', expireLoginCookie(LOGIN_CALLBACK_COOKIES.state));
	headers.append('Set-Cookie', expireLoginCookie(LOGIN_CALLBACK_COOKIES.from));

	for (const setCookie of getBackendSetCookies(upstreamRes)) {
		headers.append('Set-Cookie', setCookie);
	}

	return new Response(null, { status: 302, headers });
};
