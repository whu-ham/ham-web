/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/25 10:42:55
 *
 * EdgeOne Edge Function: POST /api/auth/app-callback
 * Proxies app login callback to the backend.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export const onRequestPost = async (context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> => {
	return proxyToBackend(context.request, '/web/auth/app-callback', context.env);
};

export const onRequestOptions = handlePreflight;
