/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Shared locale utility for reading Accept-Language from cookies.
 * M8 fix: Extracted from services/shared.ts and services/server-fetch.ts
 * so both client and server use the same logic.
 */

import { LOCALE_COOKIE } from '@/i18n/config';

/**
 * Read the active locale from the NEXT_LOCALE cookie (client-side).
 * Falls back to undefined when no explicit override cookie is present,
 * allowing the browser's own Accept-Language to be used.
 */
export const getAcceptLanguageFromDocument = (): string | undefined => {
	if (typeof document === 'undefined') return undefined;
	const raw = document.cookie
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
	if (!raw) return undefined;
	return decodeURIComponent(raw.slice(LOCALE_COOKIE.length + 1)) || undefined;
};
