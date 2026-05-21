/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * EdgeOne Edge Function: GET /api/tokens, POST /api/tokens
 * Proxies token list and creation to the backend at /web/tokens.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export const onRequestGet = async (context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> => {
	return proxyToBackend(context.request, '/web/tokens', context.env);
};

export const onRequestPost = async (context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> => {
	return proxyToBackend(context.request, '/web/tokens', context.env);
};

export const onRequestOptions = handlePreflight;
