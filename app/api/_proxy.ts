/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/23 17:07:58
 *
 * Shared BFF proxy helper used by all /api/** route handlers.
 * Forwards requests to the backend origin (server-side env var
 * HAM_BACKEND_ORIGIN) and streams the response back to the client,
 * preserving status codes, headers, and cookies.
 */

const BACKEND_ORIGIN = process.env.HAM_BACKEND_ORIGIN ?? '';

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

	return new Response(upstreamRes.body, {
		status: upstreamRes.status,
		headers: resHeaders,
	});
}
