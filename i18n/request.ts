/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/20
 *
 * Server-side `next-intl` request config. Because the project keeps the
 * URL shape stable (no `[locale]` segment), we resolve the active
 * locale on each request from:
 *
 *   1. `?lang=` query parameter (highest priority — useful when the App
 *      deep-links back into the web and wants to pin a language).
 *   2. `NEXT_LOCALE` cookie (user explicit pick).
 *   3. `Accept-Language` header (first supported match).
 *   4. `DEFAULT_LOCALE` fallback.
 *
 * Note: step (1) is best-effort. `getRequestConfig` in next-intl 4.x
 * does not expose the query string directly, so we also honour the
 * `?lang=` path inside the Language Switcher by writing the cookie
 * before triggering `router.refresh()`.
 */

import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import {
	DEFAULT_LOCALE,
	isLocale,
	LOCALE_COOKIE,
	Locale,
	LOCALES,
} from './config';

const pickFromAcceptLanguage = (header: string | null): Locale | null => {
	if (!header) return null;
	// A minimal parser that respects q-weights enough for our 3-locale
	// catalogue. We intentionally avoid a full RFC-4647 implementation
	// because it is overkill for this UI.
	const entries = header
		.split(',')
		.map((raw) => {
			const [tag, ...params] = raw.trim().split(';');
			const qParam = params.find((p) => p.trim().startsWith('q='));
			const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
			return { tag: tag.trim().toLowerCase(), q: isNaN(q) ? 0 : q };
		})
		.sort((a, b) => b.q - a.q);

	for (const { tag } of entries) {
		// Exact matches first, then prefix matches (`ja-JP` → `ja`,
		// `zh-HK` → `zh`).
		if (isLocale(tag)) return tag;
		const base = tag.split('-')[0];
		if (isLocale(base)) return base;
	}
	return null;
};

const resolveLocale = async (): Promise<Locale> => {
	const cookieStore = await cookies();
	const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
	if (isLocale(fromCookie)) {
		return fromCookie;
	}

	const headerStore = await headers();
	const fromHeader = pickFromAcceptLanguage(headerStore.get('accept-language'));
	if (fromHeader) {
		return fromHeader;
	}

	return DEFAULT_LOCALE;
};

export default getRequestConfig(async () => {
	const locale = await resolveLocale();
	// Hard-coded import map keeps the set of locales statically
	// analysable for Turbopack / Webpack bundling. Adding a new locale
	// therefore requires a touch here on top of `config.ts`.
	const messages = (
		await (locale === 'zh'
			? import('../messages/zh.json')
			: locale === 'en'
				? import('../messages/en.json')
				: import('../messages/ja.json'))
	).default;

	return {
		locale,
		messages,
	};
});

export { LOCALES };
