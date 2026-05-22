/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/22
 *
 * Server-side data fetching for token endpoints.
 * Calls the backend directly via HAM_BACKEND_ORIGIN.
 */
import { cookies } from 'next/headers';

import { LOCALE_COOKIE } from '@/i18n/config';
import type { ListTokensResponse, TokenListItem } from '@/services/token/api';

const BACKEND_ORIGIN = process.env.HAM_BACKEND_ORIGIN ?? '';
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
		const cookieStore = await cookies();
		const locale = cookieStore.get(LOCALE_COOKIE)?.value;
		const allCookies = cookieStore
			.getAll()
			.map((c) => `${c.name}=${c.value}`)
			.join('; ');

		const res = await fetch(`${BACKEND_ORIGIN}/web/tokens`, {
			headers: {
				...(locale ? { 'Accept-Language': locale } : {}),
				Cookie: allCookies,
			},
		});

		if (!res.ok) return [];
		const data = (await res.json()) as ListTokensResponse;
		return data.tokens ?? [];
	} catch {
		return [];
	}
};
