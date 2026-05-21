/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Server-side data fetching for token endpoints.
 * Used by Server Components for SSR preloading.
 */
import { cookies } from 'next/headers';

import { LOCALE_COOKIE } from '@/i18n/config';
import type { ListTokensResponse, TokenListItem } from '@/services/token/api';

const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE ?? ''}/api`;

/**
 * Fetch the token list on the server.
 * Reads the auth session from cookies and forwards Accept-Language.
 * Returns an empty array on error so the page always renders.
 */
export const fetchTokenList = async (): Promise<TokenListItem[]> => {
	try {
		const cookieStore = await cookies();
		const locale = cookieStore.get(LOCALE_COOKIE)?.value;
		const allCookies = cookieStore
			.getAll()
			.map((c) => `${c.name}=${c.value}`)
			.join('; ');

		const res = await fetch(`${API_BASE}/tokens`, {
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
