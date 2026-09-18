/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/18 18:42:33
 *
 * Shared hook for theme preference management.
 * M9 fix: Extracted from ThemeSwitcher and UserMenu to avoid duplication.
 */
'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState, startTransition } from 'react';

import {
	THEME_CLASSES,
	THEME_COLOR,
	Theme,
	isTheme,
} from '@/components/theme/config';
import { THEME_COOKIE } from '@/components/theme/config';
import {
	resolvedThemeAtom,
	systemThemeAtom,
	themeOverrideAtom,
} from '@/store/themeAtom';

const AUTO_KEY = 'auto' as const;
export type ThemeKey = typeof AUTO_KEY | Theme;

export const THEME_ICON: Record<ThemeKey, string> = {
	auto: 'brightness_auto',
	light: 'light_mode',
	dark: 'dark_mode',
};

/**
 * Writes BOTH `class="light|dark"` and `data-theme="light|dark"` on
 * `<html>`. HeroUI v3 requires both hooks.
 */
export const applyThemeToDocument = (resolved: Theme) => {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	const other: Theme = resolved === 'dark' ? 'light' : 'dark';
	root.classList.remove(THEME_CLASSES[other]);
	root.classList.add(THEME_CLASSES[resolved]);
	root.setAttribute('data-theme', resolved);
	root.style.colorScheme = resolved;
};

/**
 * Rewrites `<meta name="theme-color">` — the tint the browser paints the
 * strip above the page with, since iOS Safari owns that strip and no page
 * element can show through it — to match an explicit theme choice.
 *
 * `generateViewport` in `app/layout.tsx` emits one media-scoped entry per
 * palette plus, when a theme cookie is present, an unconditional entry
 * that outranks them. A concrete choice rewrites that entry; going back
 * to "follow system" removes it, so the media-scoped entries resume
 * tracking the OS with no further help from us.
 *
 * Driven from the selection handler rather than from an effect: a choice
 * is the only thing that can make the stored preference disagree with
 * what the server rendered, and an effect would have to re-derive the
 * choice from the shared atom. Several components call this hook, and
 * they do not all observe an update made while they are mounting — the
 * atom subscription is established in a passive effect, so an instance
 * that subscribes late can still render the pre-update value and undo
 * what an earlier instance just wrote.
 */
export const applyThemeColor = (theme: Theme | null) => {
	if (typeof document === 'undefined') return;
	const plain = Array.from(
		document.head.querySelectorAll('meta[name="theme-color"]')
	).find((meta) => !meta.getAttribute('media'));

	if (!theme) {
		plain?.remove();
		return;
	}
	if (plain) {
		plain.setAttribute('content', THEME_COLOR[theme]);
		return;
	}
	const meta = document.createElement('meta');
	meta.setAttribute('name', 'theme-color');
	meta.setAttribute('content', THEME_COLOR[theme]);
	document.head.appendChild(meta);
};

export const useThemePreference = () => {
	const [override, setOverride] = useAtom(themeOverrideAtom);
	const setSystemTheme = useSetAtom(systemThemeAtom);
	const resolvedTheme = useAtomValue(resolvedThemeAtom);

	// Track whether the cookie has been read so we can suppress the
	// hydration-sensitive derived values until the client is ready.
	const [hydrated, setHydrated] = useState(false);

	// Read the persisted theme cookie AFTER hydration so the first
	// client render matches the server (which always sees `null`).
	useEffect(() => {
		const raw = document.cookie
			.split(';')
			.map((c) => c.trim())
			.find((c) => c.startsWith(`${THEME_COOKIE}=`));
		if (raw) {
			const value = decodeURIComponent(raw.slice(THEME_COOKIE.length + 1));
			if (isTheme(value)) startTransition(() => setOverride(value));
		}
		startTransition(() => setHydrated(true));
	}, [setOverride]);

	// Keep systemThemeAtom in sync with the OS preference.
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => setSystemTheme(mql.matches ? 'dark' : 'light');
		handler(); // sync on mount
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	}, [setSystemTheme]);

	// Apply the resolved theme to the document on every change.
	useEffect(() => {
		applyThemeToDocument(resolvedTheme);
	}, [resolvedTheme]);

	// Until hydrated, `selectedKey` must be `'auto'` to match the
	// server render (override is always `null` on the server).
	const selectedKey: ThemeKey = hydrated ? (override ?? AUTO_KEY) : AUTO_KEY;

	const onSelectionChange = (key: string) => {
		if (key === AUTO_KEY) {
			setOverride(null);
			applyThemeColor(null);
		} else if (isTheme(key)) {
			setOverride(key);
			applyThemeColor(key);
		}
	};

	return { selectedKey, onSelectionChange };
};
