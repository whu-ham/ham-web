/**
 * @author Claude
 * @version 2.1
 * @date 2026/4/20
 */
'use client';

import { atom } from 'jotai';

import { THEME_COOKIE, Theme, isTheme } from '@/components/theme/config';

// --- Cookie helpers -------------------------------------------------

const readThemeCookie = (): Theme | null => {
	if (typeof document === 'undefined') return null;
	const raw = document.cookie
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${THEME_COOKIE}=`));
	if (!raw) return null;
	const value = decodeURIComponent(raw.slice(THEME_COOKIE.length + 1));
	return isTheme(value) ? value : null;
};

const writeThemeCookie = (theme: Theme) => {
	document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
	try {
		window.localStorage.setItem(THEME_COOKIE, theme);
	} catch {
		// Ignore — private mode may block storage access.
	}
};

const clearThemeCookie = () => {
	document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
	try {
		window.localStorage.removeItem(THEME_COOKIE);
	} catch {
		// Ignore — private mode may block storage access.
	}
};

// --- System theme helper --------------------------------------------

const detectSystemTheme = (): Theme => {
	if (typeof window === 'undefined' || !window.matchMedia) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
};

// --- Atoms ----------------------------------------------------------

/**
 * Base atom holding the user's explicit theme override (`light` |
 * `dark`), or `null` when they want to follow the system.
 *
 * Initialised by reading the `NEXT_THEME` cookie on first access.
 * Use `themeOverrideAtom` (the writable derived atom below) to
 * update this value — it handles cookie persistence automatically.
 */
const _themeOverrideBaseAtom = atom<Theme | null>(
	// Lazy initialiser: called once when the atom is first read.
	// On the server `readThemeCookie` returns `null`, which is the
	// correct "no override" default.
	readThemeCookie()
);
_themeOverrideBaseAtom.debugLabel = 'themeOverrideBase';

/**
 * Writable derived atom for the theme override.
 * - Read: returns the current override value.
 * - Write `null`: clears the cookie and switches to "auto" mode.
 * - Write `Theme`: persists the choice to cookie + localStorage.
 */
export const themeOverrideAtom = atom<Theme | null, [Theme | null], void>(
	(get) => get(_themeOverrideBaseAtom),
	(get, set, next: Theme | null) => {
		if (next === null) {
			clearThemeCookie();
		} else {
			writeThemeCookie(next);
		}
		set(_themeOverrideBaseAtom, next);
	}
);
themeOverrideAtom.debugLabel = 'themeOverride';

/**
 * The OS-level theme preference. Updated reactively via a
 * `matchMedia` listener when `ThemeSwitcher` mounts.
 */
export const systemThemeAtom = atom<Theme>(detectSystemTheme());
systemThemeAtom.debugLabel = 'systemTheme';

/**
 * The resolved theme: override if set, otherwise the system theme.
 * Read-only derived atom — write to `themeOverrideAtom` to change.
 */
export const resolvedThemeAtom = atom<Theme>((get) => {
	return get(themeOverrideAtom) ?? get(systemThemeAtom);
});
resolvedThemeAtom.debugLabel = 'resolvedTheme';
