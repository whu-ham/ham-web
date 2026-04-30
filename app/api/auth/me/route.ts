/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/30 15:21:00
 *
 * BFF route: GET /api/auth/me
 * Proxies the current-user session check to the backend.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export async function GET(req: Request): Promise<Response> {
	return proxyToBackend(req, '/web/auth/me');
}

export const OPTIONS = handlePreflight;
