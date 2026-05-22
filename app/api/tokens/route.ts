/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * BFF route: GET /api/tokens, POST /api/tokens
 * Proxies token list and creation to the backend at /web/tokens.
 */
import { handlePreflight, proxyToBackend } from '@/app/api/_proxy';

export const GET = async (req: Request): Promise<Response> => {
	return proxyToBackend(req, '/web/tokens');
};

export const POST = async (req: Request): Promise<Response> => {
	return proxyToBackend(req, '/web/tokens');
};

export const OPTIONS = handlePreflight;
