/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * EdgeOne Edge Function: GET /api/tokens, POST /api/tokens
 * Proxies token list and creation to the backend.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export async function onRequestGet(context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> {
	return proxyToBackend(context.request, '/api/tokens', context.env);
}

export async function onRequestPost(context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> {
	return proxyToBackend(context.request, '/api/tokens', context.env);
}

export const onRequestOptions = handlePreflight;
