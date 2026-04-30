/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/30 15:27:00
 *
 * EdgeOne Edge Function: POST /api/auth/logout
 * Proxies session logout to the backend.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export async function onRequestPost(context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> {
	return proxyToBackend(context.request, '/web/auth/logout', context.env);
}

export const onRequestOptions = handlePreflight;
