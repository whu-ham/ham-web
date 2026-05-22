/**
 * @author Claude
 * @version 1.4
 * @date 2026/5/22
 *
 * Server-side data fetching for token endpoints.
 * Calls the backend directly via serverFetch.
 *
 * M1 fix: Returns null on error instead of an empty array, so the
 * client can distinguish "no tokens" from "fetch failed".
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
		const { response, data } =
			await serverFetch<TokenListItem[]>('/web/tokens');
		if (!response.ok) return null;
		return Array.isArray(data) ? data : [];
	} catch {
		return null;
	}
};
