/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/30 15:27:00
 *
 * EdgeOne Edge Function: GET /api/auth/qr/ticket/[ticket]
 * Proxies QR ticket status polling to the backend.
 * The dynamic segment [ticket] is available via context.params.ticket.
 */
import { handlePreflight, proxyToBackend } from '../../../../_proxy';

export async function onRequestGet(context: {
	request: Request;
	env: Record<string, string>;
	params: Record<string, string>;
}): Promise<Response> {
	const ticket = encodeURIComponent(context.params.ticket ?? '');
	return proxyToBackend(
		context.request,
		`/web/auth/qr/ticket/${ticket}`,
		context.env
	);
}

export const onRequestOptions = handlePreflight;
