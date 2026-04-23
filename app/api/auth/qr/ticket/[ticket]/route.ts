/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/23 17:07:58
 *
 * BFF route: GET /api/auth/qr/ticket/[ticket]
 * Proxies QR ticket status polling to the backend.
 */
import { proxyToBackend } from '@/app/api/_proxy';

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ ticket: string }> }
): Promise<Response> {
	const { ticket } = await params;
	return proxyToBackend(
		req,
		`/web/auth/qr/ticket/${encodeURIComponent(ticket)}`
	);
}
