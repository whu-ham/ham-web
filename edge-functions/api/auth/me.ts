/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/23 20:31:47
 *
 * EdgeOne Edge Function: GET /api/auth/me
 * Proxies the current-user session check to the backend.
 */
import { proxyToBackend } from '../../_proxy';

export async function onRequestGet(context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> {
	return proxyToBackend(context.request, '/web/auth/me', context.env);
}
