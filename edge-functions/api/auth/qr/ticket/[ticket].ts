/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/23 20:31:47
 *
 * EdgeOne Edge Function: GET /api/auth/qr/ticket/[ticket]
 * Proxies QR ticket status polling to the backend.
 * The dynamic segment [ticket] is available via context.params.ticket.
 */
import { proxyToBackend } from '../../../../_proxy';

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
