/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * EdgeOne Edge Function: POST /api/tokens/:id/rotate
 * Proxies token rotation to the backend at /web/tokens/:id/rotate.
 */
import { handlePreflight, proxyToBackend } from '../../../_proxy';

export const onRequestPost = async (context: {
	request: Request;
	env: Record<string, string>;
	params: Record<string, string>;
}): Promise<Response> => {
	const id = encodeURIComponent(context.params.id ?? '');
	return proxyToBackend(
		context.request,
		`/web/tokens/${id}/rotate`,
		context.env
	);
};

export const onRequestOptions = handlePreflight;
