/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/22
 *
 * Server-side data fetching for token endpoints.
 * Calls the backend directly via serverFetch.
 */
import { serverFetch } from '@/services/server-fetch';

import type { ListTokensResponse, TokenListItem } from '@/services/token/api';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Fetch the token list on the server.
 * In development, returns mock data directly (MSW is browser-only).
 * In production, reads the auth session from cookies and forwards Accept-Language.
 * Returns an empty array on error so the page always renders.
 */
export const fetchTokenList = async (): Promise<TokenListItem[]> => {
	if (isDev) {
		const { mockTokenList } = await import('@/mocks/data');
		return mockTokenList;
	}

	try {
		const res = await serverFetch('/web/tokens');
		if (!res.ok) return [];
		const data = (await res.json()) as ListTokensResponse;
		return data.tokens ?? [];
	} catch {
		return [];
	}
};
