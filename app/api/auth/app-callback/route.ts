/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * BFF route: POST /api/auth/app-callback
 * Proxies app login callback to the backend.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export async function POST(req: Request): Promise<Response> {
	return proxyToBackend(req, '/api/auth/app-callback');
}

export const OPTIONS = handlePreflight;
