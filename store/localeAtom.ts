/**
 * @author Claude
 * @version 2.2
 * @date 2026/4/20 19:19:47
 */
'use client';

import { atom } from 'jotai';

import { LOCALE_COOKIE, Locale, isLocale } from '@/i18n/config';

// --- Cookie helper --------------------------------------------------

const readLocaleCookie = (): Locale | null => {
	if (typeof document === 'undefined') return null;
	const raw = document.cookie
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
	if (!raw) return null;
	const value = decodeURIComponent(raw.slice(LOCALE_COOKIE.length + 1));
	return isLocale(value) ? value : null;
};

// --- Atom -----------------------------------------------------------

/**
 * Whether the user has an explicit locale override cookie set.
 * `true`  → cookie present; the active locale is the one the server
 *           resolved from the cookie.
 * `false` → no cookie; the server resolves from `Accept-Language`.
 *
 * This is a simple boolean because `LanguageSwitcher` only needs to
 * know "is there an override?" — the actual locale value comes from
 * `useLocale()` (next-intl), which is always in sync with the server.
 *
 * Write `true` to signal that a cookie was just written (the
 * component handles the actual cookie write before calling `set`).
 * Write `false` to signal that the cookie was just cleared.
 *
 * Uses a primitive atom so that `useAtom` writes work correctly.
 * The initial value is lazily read from the cookie on first render.
 */
export const localeOverrideAtom = atom<boolean>(readLocaleCookie() !== null);
localeOverrideAtom.debugLabel = 'localeOverride';
