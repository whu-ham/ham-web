/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * BFF route: POST /api/tokens/:id/rotate
 * Proxies token rotation to the backend at /web/tokens/:id/rotate.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export const POST = async (
	req: Request,
	{ params }: { params: Promise<{ id: string }> }
): Promise<Response> => {
	const { id } = await params;
	return proxyToBackend(req, `/web/tokens/${encodeURIComponent(id)}/rotate`);
};

export const OPTIONS = handlePreflight;
