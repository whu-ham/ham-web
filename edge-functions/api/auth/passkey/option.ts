/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/23 20:31:47
 *
 * EdgeOne Edge Function: POST /api/auth/passkey/option
 * Proxies passkey challenge option request to the backend.
 */
import { proxyToBackend } from '../../../_proxy';

export async function onRequestPost(context: {
	request: Request;
	env: Record<string, string>;
}): Promise<Response> {
	return proxyToBackend(
		context.request,
		'/web/auth/passkey/option',
		context.env
	);
}
