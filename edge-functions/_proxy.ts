/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/23 20:31:47
 *
 * Shared BFF proxy helper used by all EdgeOne Edge Function handlers.
 * Forwards requests to the backend origin (env var HAM_BACKEND_ORIGIN)
 * and streams the response back to the client, preserving status codes,
 * headers, and cookies.
 */

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

	return new Response(upstreamRes.body, {
		status: upstreamRes.status,
		headers: resHeaders,
	});
}
