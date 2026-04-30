/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/30 15:27:00
 *
 * EdgeOne Edge Function: POST /api/auth/refresh
 * Proxies session token refresh to the backend.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export async function onRequestPost(context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> {
	return proxyToBackend(context.request, '/web/auth/refresh', context.env);
}

export const onRequestOptions = handlePreflight;
