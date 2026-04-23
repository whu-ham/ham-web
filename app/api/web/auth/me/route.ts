/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/23 17:07:58
 *
 * BFF route: GET /api/web/auth/me
 * Proxies the current-user session check to the backend.
 */
import { proxyToBackend } from '@/app/api/_proxy';

export async function GET(req: Request): Promise<Response> {
	return proxyToBackend(req, '/web/auth/me');
}
