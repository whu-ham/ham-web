/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * EdgeOne Edge Function: POST /api/tokens/:id/rotate
 * Proxies token rotation to the backend.
 */
import { handlePreflight, proxyToBackend } from '../../../_proxy';

export async function onRequestPost(context: {
	request: Request;
	env: Record<string, string>;
	params: Record<string, string>;
}): Promise<Response> {
	const id = encodeURIComponent(context.params.id ?? '');
	return proxyToBackend(
		context.request,
		`/api/tokens/${id}/rotate`,
		context.env
	);
}

export const onRequestOptions = handlePreflight;
