/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/30 15:21:00
 *
 * BFF route: GET /api/auth/qr/ticket/[ticket]
 * Proxies QR ticket status polling to the backend.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

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

export const OPTIONS = handlePreflight;
