/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * EdgeOne Edge Function: DELETE /api/tokens/:id
 * Proxies token revocation to the backend.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export async function onRequestDelete(context: {
	request: Request;
	env: Record<string, string>;
	params: Record<string, string>;
}): Promise<Response> {
	const id = encodeURIComponent(context.params.id ?? '');
	return proxyToBackend(context.request, `/api/tokens/${id}`, context.env);
}

export const onRequestOptions = handlePreflight;
