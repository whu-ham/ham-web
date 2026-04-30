/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/30 15:27:00
 *
 * Shared BFF proxy helper used by all EdgeOne Edge Function handlers.
 * Forwards requests to the backend origin (env var HAM_BACKEND_ORIGIN)
 * and streams the response back to the client, preserving status codes,
 * headers, and cookies.
 *
 * Cross-origin support
 * --------------------
 * When the frontend is deployed to a different origin than this BFF (e.g.
 * pages on Cloudflare Workers, BFF here on EdgeOne), set the EdgeOne env
 * binding `WEB_BASE_URL` to the absolute frontend origin(s). Comma-separated
 * values are supported for multi-origin setups, e.g.:
 *   WEB_BASE_URL=https://sso.example.com,https://admin.example.com
 * Every response emitted by this proxy will then carry the appropriate
 * CORS headers (echoing the caller's Origin when it is in the allow-list)
 * and credentials-with-cookies will work across origins. Leave
 * `WEB_BASE_URL` unset for single-origin deployments — no CORS headers
 * are added in that case.
 */

/**
 * Headers the browser is allowed to send on cross-origin requests. We keep
 * the list explicit (rather than mirroring `Access-Control-Request-Headers`)
 * so the BFF's accepted surface stays auditable.
 */
const ALLOWED_REQUEST_HEADERS = [
	'Content-Type',
	'Accept',
	'Accept-Language',
	'Authorization',
].join(', ');

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

/**
 * Parse the comma-separated `WEB_BASE_URL` env binding into a Set of
 * normalized origins. Each entry is trimmed and has any trailing slash
 * removed so callers don't need to care about the exact format set in
 * the EdgeOne console.
 */
function parseAllowedOrigins(env: Record<string, string>): ReadonlySet<string> {
	return new Set(
		(env.WEB_BASE_URL ?? '')
			.split(',')
			.map((o) => o.trim().replace(/\/$/, ''))
			.filter(Boolean)
	);
}

/**
 * Decide whether the incoming request should receive CORS headers, and
 * which origin to echo back. Returns `null` when no CORS headers should
 * be added (single-origin deploy, or request Origin does not match the
 * configured allow-list).
 */
function resolveAllowedOrigin(
	req: Request,
	env: Record<string, string>
): string | null {
	const allowed = parseAllowedOrigins(env);
	if (allowed.size === 0) return null;
	const reqOrigin = req.headers.get('origin');
	if (!reqOrigin) return null;
	return allowed.has(reqOrigin) ? reqOrigin : null;
}

/**
 * Append CORS headers to an existing Headers object when the request
 * origin is allow-listed. Mutates and returns the same Headers instance
 * for call-site convenience.
 */
function applyCorsHeaders(
	headers: Headers,
	req: Request,
	env: Record<string, string>
): Headers {
	const allowedOrigin = resolveAllowedOrigin(req, env);
	// Always advertise that responses vary by Origin so shared caches
	// (CDNs / EdgeOne) don't mix cross-origin responses between callers.
	headers.append('Vary', 'Origin');
	if (allowedOrigin) {
		headers.set('Access-Control-Allow-Origin', allowedOrigin);
		headers.set('Access-Control-Allow-Credentials', 'true');
	}
	return headers;
}

/**
 * Handle a CORS preflight (OPTIONS) request. Edge Function files should
 * `export const onRequestOptions = handlePreflight;` so browsers get a
 * valid 204 response before firing the real credentialed request.
 */
export function handlePreflight(context: {
	request: Request;
	env: Record<string, string>;
}): Response {
	const headers = new Headers();
	applyCorsHeaders(headers, context.request, context.env);
	// Only advertise allowed methods / headers when we actually accept
	// this origin — otherwise respond with a bare 204 and let the browser
	// surface the CORS failure as it would for any disallowed origin.
	if (resolveAllowedOrigin(context.request, context.env)) {
		headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
		headers.set('Access-Control-Allow-Headers', ALLOWED_REQUEST_HEADERS);
		// Cache the preflight result for 24h to avoid an OPTIONS round-trip
		// before every credentialed call.
		headers.set('Access-Control-Max-Age', '86400');
	}
	return new Response(null, { status: 204, headers });
}

/**
 * Proxy an incoming Request to the backend and return the backend Response.
 * @param req     The incoming Request object.
 * @param path    The backend path to forward to (e.g. "/web/auth/me").
 * @param env     The EdgeOne environment bindings (must contain HAM_BACKEND_ORIGIN).
 */
export async function proxyToBackend(
	req: Request,
	path: string,
	env: Record<string, string>
): Promise<Response> {
	const origin = env.HAM_BACKEND_ORIGIN ?? '';
	const url = `${origin}${path}`;

	// Forward all original headers except Host (set automatically by fetch).
	const forwardHeaders = new Headers(req.headers);
	forwardHeaders.delete('host');

	const upstreamRes = await fetch(url, {
		method: req.method,
		headers: forwardHeaders,
		body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
	});

	// Copy response headers back to the client (including Set-Cookie).
	const resHeaders = new Headers(upstreamRes.headers);
	// Remove transfer-encoding — the edge runtime handles chunking itself.
	resHeaders.delete('transfer-encoding');
	// Attach CORS headers so cross-origin callers (see WEB_BASE_URL) can
	// read the response under `credentials: 'include'`.
	applyCorsHeaders(resHeaders, req, env);

	return new Response(upstreamRes.body, {
		status: upstreamRes.status,
		headers: resHeaders,
	});
}
