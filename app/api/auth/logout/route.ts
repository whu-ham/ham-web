/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/30 15:21:00
 *
 * BFF route: POST /api/auth/logout
 * Proxies session logout to the backend.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export async function POST(req: Request): Promise<Response> {
	return proxyToBackend(req, '/web/auth/logout');
}

export const OPTIONS = handlePreflight;
