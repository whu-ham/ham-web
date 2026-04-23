/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/23 17:07:58
 *
 * BFF route: POST /api/web/sso/consent/confirm
 * Proxies consent confirmation to the backend.
 */
import { proxyToBackend } from '@/app/api/_proxy';

export async function POST(req: Request): Promise<Response> {
	return proxyToBackend(req, '/web/sso/consent/confirm');
}
