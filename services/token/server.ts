/**
 * @author Claude
 * @version 1.5
 * @date 2026/9/23 01:31:52
 *
 * Server-side data fetching for token endpoints.
 * Calls the backend directly via serverFetch.
 *
 * M1 fix: Returns null on error instead of an empty array, so the
 * client can distinguish "no tokens" from "fetch failed".
 *
 * r6 fix: a 200 with a body that is not JSON is a failure too. It used
 * to become an empty array, which the client renders as "no API keys"
 * with no retry button.
 * Mock data is only loaded when NEXT_PUBLIC_ENABLE_MSW is
 * explicitly 'true', preventing mocks from entering production bundles.
 */
import { serverFetch } from '@/services/server-fetch';

import type { TokenListItem } from '@/services/token/api';
/**
 * Fetch the token list on the server.
 * When MSW is enabled, returns mock data directly (MSW is browser-only).
 * In production, reads the auth session from cookies and forwards Accept-Language.
 * Returns null on error so the client can distinguish "no tokens" from "fetch failed".
 */
export const fetchTokenList = async (): Promise<TokenListItem[] | null> => {
	try {
		const { response, data, bodyIsJson } =
			await serverFetch<TokenListItem[]>('/web/tokens');
		// A gateway error page must not be reported as an empty list.
		if (!response.ok || !bodyIsJson) return null;
		return Array.isArray(data) ? data : [];
	} catch {
		return null;
	}
};
