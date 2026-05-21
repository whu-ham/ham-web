/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * BFF route: POST /api/tokens/:id/rotate
 * Proxies token rotation to the backend.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ id: string }> }
): Promise<Response> {
	const { id } = await params;
	return proxyToBackend(
		req,
		`/api/tokens/${encodeURIComponent(id)}/rotate`
	);
}

export const OPTIONS = handlePreflight;
