/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/21 15:29:39
 */
import './globals.css';
import '@material-design-icons/font/index.css';
import React from 'react';
import type { Metadata } from 'next';
import { Providers } from '@/app/providers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import { HTML_LANG, isLocale } from '@/i18n/config';
import {
	DEFAULT_SERVER_THEME,
	THEME_BOOTSTRAP_SCRIPT,
	THEME_COOKIE,
	Theme,
	isTheme,
} from '@/components/theme/config';

export const metadata: Metadata = {
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ham.nowcent.cn'
	),
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// `getLocale()` resolves the active language via the
	// `i18n/request.ts` pipeline (cookie → Accept-Language → default).
	// Messages are loaded once per request so both server and client
	// components share the same catalogue.
	const locale = await getLocale();
	const messages = await getMessages();
	const htmlLang = isLocale(locale) ? HTML_LANG[locale] : 'zh-CN';

	// Resolve the initial theme on the server so the first paint already
	// carries the correct palette. When the cookie is absent (user has
	// never interacted with the switcher, i.e. they're in "auto" mode)
	// we emit the conservative default and rely on the inline bootstrap
	// script in <head> to upgrade to dark before the browser paints, if
	// the user's OS is dark-themed.
	const cookieStore = await cookies();
	const rawTheme = cookieStore.get(THEME_COOKIE)?.value;
	const initialTheme: Theme = isTheme(rawTheme)
		? rawTheme
		: DEFAULT_SERVER_THEME;

	return (
		// `suppressHydrationWarning` is required because the inline
		// bootstrap script may legitimately mutate `class` / `data-theme`
		// on <html> before React hydrates (e.g. auto mode resolving to
		// dark on a user with a dark-themed OS).
		<html
			lang={htmlLang}
			className={initialTheme}
			data-theme={initialTheme}
			style={{ colorScheme: initialTheme }}
			suppressHydrationWarning
		>
			<head>
				{/*
				 * Blocking inline script: reconciles <html> with the user's
				 * real theme preference BEFORE the browser paints the body.
				 * This is the standard anti-FOUC pattern used by
				 * `next-themes`, shadcn/ui, and others — running it inside
				 * `<head>` guarantees it executes before any DOM content
				 * becomes visible.
				 */}
				<script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
			</head>
			<Body locale={locale} messages={messages}>
				{children}
			</Body>
		</html>
	);
}

const Body = ({
	children,
	locale,
	messages,
}: {
	children: React.ReactNode;
	locale: string;
	messages: Awaited<ReturnType<typeof getMessages>>;
}) => {
	return (
		<body suppressHydrationWarning>
			{/*
			 * Re-run the same bootstrap script at the top of <body>.
			 * React hydration reconciles <html> attributes against the
			 * server-rendered HTML (which may be 'light' in auto mode),
			 * potentially overwriting what the <head> script wrote.
			 * Running it again here — synchronously, before any React
			 * content is painted — ensures the correct theme is always
			 * in place after hydration without waiting for useEffect.
			 */}
			<script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
			<NextIntlClientProvider locale={locale} messages={messages}>
				<Providers>{children}</Providers>
			</NextIntlClientProvider>
		</body>
	);
};
