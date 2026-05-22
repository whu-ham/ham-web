/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * EdgeOne Edge Function: DELETE /api/tokens/:id
 * Proxies token revocation to the backend at /web/tokens/:id.
 */
import { handlePreflight, proxyToBackend } from '../../_proxy';

export const onRequestDelete = async (context: {
	request: Request;
	env: Record<string, string>;
	params: Record<string, string>;
}): Promise<Response> => {
	const id = encodeURIComponent(context.params.id ?? '');
	return proxyToBackend(context.request, `/web/tokens/${id}`, context.env);
};

export const onRequestOptions = handlePreflight;
