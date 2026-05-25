/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/25 10:40:45
 *
 * BFF route: POST /api/auth/app-callback
 * Proxies app login callback to the backend.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export const POST = async (req: Request): Promise<Response> => {
	return proxyToBackend(req, '/web/auth/app-callback');
};

export const OPTIONS = handlePreflight;
