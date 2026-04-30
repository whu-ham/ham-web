/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/30 15:27:00
 *
 * EdgeOne Edge Function: GET /api/auth/me
 * Proxies the current-user session check to the backend.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export async function onRequestGet(context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> {
	return proxyToBackend(context.request, '/web/auth/me', context.env);
}

export const onRequestOptions = handlePreflight;
