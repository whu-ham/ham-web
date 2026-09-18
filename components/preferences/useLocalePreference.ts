/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/18 22:43:43
 *
 * Shared hook for locale preference management.
 * M9 fix: Extracted from LanguageSwitcher and UserMenu to avoid duplication.
 */
'use client';

import { useAtom } from 'jotai';
import { useLocale } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';

import { LOCALE_COOKIE, LOCALE_LABELS, Locale, isLocale } from '@/i18n/config';
import { localeOverrideAtom } from '@/store/localeAtom';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import zhMessages from '@/messages/zh.json';

const AUTO_KEY = 'auto' as const;
export type LocaleKey = typeof AUTO_KEY | Locale;

export const LOCALE_ICON: Record<Locale | 'auto', string> = {
	auto: 'language',
	zh: '文',
	en: 'A',
	ja: 'あ',
};

const LOCALE_MESSAGES: Record<Locale, typeof enMessages> = {
	zh: zhMessages,
	en: enMessages,
	ja: jaMessages,
};

/**
 * Best-effort match of the browser's preferred language against our
 * supported catalogue.
 */
export const detectBrowserLocale = (): Locale | null => {
	if (typeof navigator === 'undefined') return null;
	const candidates: string[] = [];
	if (Array.isArray(navigator.languages))
		candidates.push(...navigator.languages);
	if (navigator.language) candidates.push(navigator.language);
	for (const raw of candidates) {
		const tag = raw.toLowerCase();
		if (isLocale(tag)) return tag;
		const base = tag.split('-')[0];
		if (isLocale(base)) return base;
	}
	return null;
};

/**
 * Resolve the "Follow browser" label in the browser's own language.
 */
export const resolveAutoLabel = (
	browserLocale: Locale | null,
	fallback: string
): string => {
	if (!browserLocale) return fallback;
	const catalogue = LOCALE_MESSAGES[browserLocale].language.switcher;
	return catalogue.autoWithDetected.replace(
		'{detected}',
		LOCALE_LABELS[browserLocale]
	);
};

export const writeLocaleCookie = (locale: Locale) => {
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
	try {
		window.localStorage.setItem(LOCALE_COOKIE, locale);
	} catch {
		// Ignore — private mode may block storage access.
	}
};

export const clearLocaleCookie = () => {
	document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
	try {
		window.localStorage.removeItem(LOCALE_COOKIE);
	} catch {
		// Ignore — private mode may block storage access.
	}
};

export const useLocalePreference = () => {
	const currentLocale = useLocale() as Locale;
	const [, startTransition] = useTransition();
	// Shared flag. A pick made in one switcher is mirrored here so the
	// other mounted switchers (the header renders the desktop pair and
	// the compact user menu at once) reflect it without a reload.
	const [sharedOverride, setSharedOverride] = useAtom(localeOverrideAtom);
	// The cookie read has to be per-instance too. Whichever switcher
	// mounts first used to be the only one to publish the value, so the
	// compact menu kept rendering "Follow browser" even when the cookie
	// held an explicit language.
	const [cookieOverride, setCookieOverride] = useState(false);
	const [browserLocale, setBrowserLocale] = useState<Locale | null>(null);
	const [hydrated, setHydrated] = useState(false);

	// Read cookie & browser locale AFTER hydration to avoid mismatch.
	useEffect(() => {
		// Detect browser locale
		const detected = detectBrowserLocale();
		if (detected) startTransition(() => setBrowserLocale(detected));

		// Read locale override cookie
		const raw = document.cookie
			.split(';')
			.map((c) => c.trim())
			.find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
		if (raw) {
			const value = decodeURIComponent(raw.slice(LOCALE_COOKIE.length + 1));
			if (isLocale(value)) {
				startTransition(() => setCookieOverride(true));
				startTransition(() => setSharedOverride(true));
			}
		}
		startTransition(() => setHydrated(true));
	}, [setSharedOverride, startTransition]);

	const hasOverride = cookieOverride || sharedOverride;

	// Until hydrated, treat as "auto" to match server render.
	const selectedKey: LocaleKey =
		hydrated && hasOverride ? currentLocale : AUTO_KEY;

	const onSelectionChange = (rawKey: string) => {
		if (rawKey === AUTO_KEY) {
			if (!hasOverride) return;
			clearLocaleCookie();
			setCookieOverride(false);
			setSharedOverride(false);
			startTransition(() => window.location.reload());
		} else if (isLocale(rawKey)) {
			if (hasOverride && rawKey === currentLocale) return;
			writeLocaleCookie(rawKey);
			setCookieOverride(true);
			setSharedOverride(true);
			if (!hasOverride && rawKey === browserLocale) return;
			startTransition(() => window.location.reload());
		}
	};

	return { selectedKey, browserLocale, onSelectionChange };
};
