/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Shared hook for theme preference management.
 * M9 fix: Extracted from ThemeSwitcher and UserMenu to avoid duplication.
 */
'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState, startTransition } from 'react';

import { THEME_CLASSES, Theme, isTheme } from '@/components/theme/config';
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
		} else if (isTheme(key)) {
			setOverride(key);
		}
	};

	return { selectedKey, onSelectionChange };
};
