/**
 * @author Claude
 * @version 1.2
 * @date 2026/4/30 15:25:00
 *
 * Shared BFF proxy helper used by all /api/** route handlers.
 * Forwards requests to the backend origin (server-side env var
 * HAM_BACKEND_ORIGIN) and streams the response back to the client,
 * preserving status codes, headers, and cookies.
 *
 * Cross-origin support
 * --------------------
 * When the frontend is deployed to a different origin than the BFF (e.g.
 * pages on Cloudflare Workers, BFF on EdgeOne), set the server-side env
 * var `WEB_BASE_URL` to the absolute frontend origin(s). Comma-separated
 * values are supported for multi-origin setups, e.g.:
 *   WEB_BASE_URL=https://sso.example.com,https://admin.example.com
 * Every response emitted by this proxy will then carry the appropriate
 * CORS headers (echoing the caller's Origin when it is in the allow-list)
 * and credentials-with-cookies will work across origins. Leave
 * `WEB_BASE_URL` unset for single-origin deployments — no CORS headers
 * are added in that case.
 */

const BACKEND_ORIGIN = process.env.HAM_BACKEND_ORIGIN ?? '';

/**
 * Absolute frontend origins that are allowed to call this BFF cross-origin.
 * Parsed once at module load from the comma-separated `WEB_BASE_URL` env.
 * Each entry must be an exact origin (scheme + host + optional port), NOT
 * a wildcard, because we echo the matched origin back in
 * `Access-Control-Allow-Origin` together with
 * `Access-Control-Allow-Credentials: true` — and browsers reject `*` in
 * that combination.
 */
const ALLOWED_WEB_ORIGINS: ReadonlySet<string> = new Set(
	(process.env.WEB_BASE_URL ?? '')
		.split(',')
		.map((o) => o.trim().replace(/\/$/, ''))
		.filter(Boolean)
);

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
 * Decide whether the incoming request should receive CORS headers, and
 * which origin to echo back. Returns `null` when no CORS headers should
 * be added (single-origin deploy, or request Origin does not match the
 * configured allow-list).
 */
function resolveAllowedOrigin(req: Request): string | null {
	if (ALLOWED_WEB_ORIGINS.size === 0) return null;
	const reqOrigin = req.headers.get('origin');
	if (!reqOrigin) return null;
	return ALLOWED_WEB_ORIGINS.has(reqOrigin) ? reqOrigin : null;
}

/**
 * Append CORS headers to an existing Headers object when the request
 * origin is allow-listed. Mutates and returns the same Headers instance
 * for call-site convenience.
 */
function applyCorsHeaders(headers: Headers, req: Request): Headers {
	const allowedOrigin = resolveAllowedOrigin(req);
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
 * Handle a CORS preflight (OPTIONS) request. Route handlers should
 * `export const OPTIONS = handlePreflight;` so browsers get a valid
 * 204 response before firing the real credentialed request.
 */
export function handlePreflight(req: Request): Response {
	const headers = new Headers();
	applyCorsHeaders(headers, req);
	// Only advertise allowed methods / headers when we actually accept
	// this origin — otherwise respond with a bare 204 and let the browser
	// surface the CORS failure as it would for any disallowed origin.
	if (resolveAllowedOrigin(req)) {
		headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
		headers.set('Access-Control-Allow-Headers', ALLOWED_REQUEST_HEADERS);
		// Cache the preflight result for 24h to avoid an OPTIONS round-trip
		// before every credentialed call.
		headers.set('Access-Control-Max-Age', '86400');
	}
	return new Response(null, { status: 204, headers });
}

/**
 * Proxy a Next.js Request to the backend and return the backend Response.
 * @param req  The incoming Next.js Request object.
 * @param path The backend path to forward to (e.g. "/web/auth/me").
 */
export async function proxyToBackend(
	req: Request,
	path: string
): Promise<Response> {
	const url = `${BACKEND_ORIGIN}${path}`;

	// Forward all original headers except Host (which fetch sets automatically).
	const forwardHeaders = new Headers(req.headers);
	forwardHeaders.delete('host');

	const upstreamRes = await fetch(url, {
		method: req.method,
		headers: forwardHeaders,
		body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
		// @ts-expect-error — Node 18+ / Cloudflare Workers support duplex
		duplex: 'half',
	});

	// Copy response headers back to the client (including Set-Cookie).
	const resHeaders = new Headers(upstreamRes.headers);
	// Remove transfer-encoding — Next.js handles chunking itself.
	resHeaders.delete('transfer-encoding');
	// Attach CORS headers so cross-origin callers (see WEB_BASE_URL) can
	// read the response under `credentials: 'include'`.
	applyCorsHeaders(resHeaders, req);

	return new Response(upstreamRes.body, {
		status: upstreamRes.status,
		headers: resHeaders,
	});
}
