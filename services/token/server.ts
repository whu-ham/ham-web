/**
 * @author Claude
 * @version 1.3
 * @date 2026/5/22
 *
 * Server-side data fetching for token endpoints.
 * Calls the backend directly via serverFetch.
 *
 * M1 fix: Mock data is only loaded when NEXT_PUBLIC_ENABLE_MSW is
 * explicitly 'true', preventing mocks from entering production bundles.
 */
import { serverFetch } from '@/services/server-fetch';

import type { ListTokensResponse, TokenListItem } from '@/services/token/api';

const isMswEnabled = process.env.NEXT_PUBLIC_ENABLE_MSW === 'true';

/**
 * Fetch the token list on the server.
 * When MSW is enabled, returns mock data directly (MSW is browser-only).
 * In production, reads the auth session from cookies and forwards Accept-Language.
 * Returns an empty array on error so the page always renders.
 */
export const fetchTokenList = async (): Promise<TokenListItem[]> => {
	if (isMswEnabled) {
		const { mockTokenList } = await import('@/mocks/data');
		return structuredClone(mockTokenList);
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
