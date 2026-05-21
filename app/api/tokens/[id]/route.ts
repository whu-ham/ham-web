/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * BFF route: DELETE /api/tokens/:id
 * Proxies token revocation to the backend at /web/tokens/:id.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export const DELETE = async (
	req: Request,
	{ params }: { params: Promise<{ id: string }> }
): Promise<Response> => {
	const { id } = await params;
	return proxyToBackend(req, `/web/tokens/${encodeURIComponent(id)}`);
};

export const OPTIONS = handlePreflight;
