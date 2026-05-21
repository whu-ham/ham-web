/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * EdgeOne Edge Function: POST /api/auth/app-callback
 * Proxies app login callback to the backend.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export async function onRequestPost(context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> {
	return proxyToBackend(context.request, '/api/auth/app-callback', context.env);
}

export const onRequestOptions = handlePreflight;
