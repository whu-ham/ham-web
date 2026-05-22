/**
 * @author Claude
 * @version 1.3
 * @date 2026/5/22
 *
 * User menu dropdown with logout action.
 * In compact mode (mobile), also includes theme & language switching.
 */
'use client';

import type { Selection } from '@heroui/react';

import {
	Dropdown,
	Header,
	Label,
	Separator,
	buttonVariants,
} from '@heroui/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';

import {
	LOCALES,
	LOCALE_COOKIE,
	LOCALE_LABELS,
	Locale,
	isLocale,
} from '@/i18n/config';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import zhMessages from '@/messages/zh.json';
import { localeOverrideAtom } from '@/store/localeAtom';
import {
	THEMES,
	THEME_CLASSES,
	Theme,
	isTheme,
} from '@/components/theme/config';
import {
	resolvedThemeAtom,
	systemThemeAtom,
	themeOverrideAtom,
} from '@/store/themeAtom';

const LOCALE_MESSAGES: Record<Locale, typeof enMessages> = {
	zh: zhMessages,
	en: enMessages,
	ja: jaMessages,
};

const AUTO_THEME_KEY = 'auto' as const;
type ThemeKey = typeof AUTO_THEME_KEY | Theme;

const THEME_ICON: Record<ThemeKey, string> = {
	auto: 'brightness_auto',
	light: 'light_mode',
	dark: 'dark_mode',
};

const LOCALE_ICON: Record<Locale | 'auto', string> = {
	auto: 'language',
	zh: '文',
	en: 'A',
	ja: 'あ',
};

const AUTO_LOCALE_KEY = 'auto' as const;

const detectBrowserLocale = (): Locale | null => {
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

const resolveAutoLabel = (
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

const writeLocaleCookie = (locale: Locale) => {
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
	try {
		window.localStorage.setItem(LOCALE_COOKIE, locale);
	} catch {
		// Ignore
	}
};

const clearLocaleCookie = () => {
	document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
	try {
		window.localStorage.removeItem(LOCALE_COOKIE);
	} catch {
		// Ignore
	}
};

const applyThemeToDocument = (resolved: Theme) => {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	const other: Theme = resolved === 'dark' ? 'light' : 'dark';
	root.classList.remove(THEME_CLASSES[other]);
	root.classList.add(THEME_CLASSES[resolved]);
	root.setAttribute('data-theme', resolved);
	root.style.colorScheme = resolved;
};

interface UserMenuProps {
	onLogout: () => void;
	/** When true, includes theme & language options in the dropdown */
	compact?: boolean;
}

const UserMenu = ({ onLogout, compact }: UserMenuProps) => {
	const tCommon = useTranslations('common');
	const tTheme = useTranslations('theme');
	const tLang = useTranslations('language');
	const currentLocale = useLocale() as Locale;
	const [, startTransition] = useTransition();

	// Theme state
	const [override, setOverride] = useAtom(themeOverrideAtom);
	const setSystemTheme = useSetAtom(systemThemeAtom);
	const resolvedTheme = useAtomValue(resolvedThemeAtom);

	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => setSystemTheme(mql.matches ? 'dark' : 'light');
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	}, [setSystemTheme]);

	useEffect(() => {
		applyThemeToDocument(resolvedTheme);
	}, [resolvedTheme]);

	// Locale state
	const [hasOverride, setHasOverride] = useAtom(localeOverrideAtom);
	const [browserLocale] = useState<Locale | null>(() => detectBrowserLocale());

	const selectedThemeKey: ThemeKey = override ?? AUTO_THEME_KEY;
	const selectedLocaleKey = hasOverride ? currentLocale : AUTO_LOCALE_KEY;
	const autoLocaleLabel = resolveAutoLabel(
		browserLocale,
		tLang('switcher.auto')
	);

	const onThemeSelectionChange = (keys: Selection) => {
		const rawKey = Array.from(keys)[0]?.toString();
		if (!rawKey) return;
		// Strip "theme-" prefix
		const key = rawKey.replace(/^theme-/, '');
		if (key === AUTO_THEME_KEY) {
			setOverride(null);
		} else if (isTheme(key)) {
			setOverride(key);
		}
	};

	const onLocaleSelectionChange = (keys: Selection) => {
		const rawKey = Array.from(keys)[0]?.toString();
		if (!rawKey) return;
		// Strip "locale-" prefix
		const key = rawKey.replace(/^locale-/, '');
		if (key === AUTO_LOCALE_KEY) {
			if (!hasOverride) return;
			clearLocaleCookie();
			setHasOverride(false);
			startTransition(() => window.location.reload());
		} else if (isLocale(key)) {
			if (hasOverride && key === currentLocale) return;
			writeLocaleCookie(key);
			setHasOverride(true);
			if (!hasOverride && key === browserLocale) return;
			startTransition(() => window.location.reload());
		}
	};

	return (
		<Dropdown>
			<Dropdown.Trigger
				aria-label={tCommon('menu')}
				className={buttonVariants({
					size: 'sm',
					variant: 'tertiary',
					isIconOnly: true,
					className: 'inline-flex items-center justify-center',
				})}
			>
				<span
					className={
						'material-icons-round text-[18px]! leading-none! text-gray-500'
					}
					aria-hidden={true}
				>
					more_vert
				</span>
			</Dropdown.Trigger>
			<Dropdown.Popover placement='bottom end'>
				<Dropdown.Menu onAction={(key) => key === 'logout' && onLogout()}>
					{compact && (
						<>
							{/* Theme section */}
							<Dropdown.Section
								selectionMode='single'
								selectedKeys={new Set([`theme-${selectedThemeKey}`])}
								onSelectionChange={onThemeSelectionChange}
							>
								<Header>{tTheme('switcher.ariaLabel')}</Header>
								{(['auto', ...THEMES] as const).map((key) => {
									const label =
										key === AUTO_THEME_KEY
											? tTheme('switcher.auto')
											: tTheme(`switcher.${key}`);
									return (
										<Dropdown.Item
											key={`theme-${key}`}
											id={`theme-${key}`}
											textValue={label}
										>
											<Dropdown.ItemIndicator />
											<Label className={'inline-flex items-center gap-2'}>
												<span
													className={
														'material-icons-round text-[18px]! leading-none! text-gray-500'
													}
													aria-hidden={true}
												>
													{THEME_ICON[key]}
												</span>
												<span className={'leading-none'}>{label}</span>
											</Label>
										</Dropdown.Item>
									);
								})}
							</Dropdown.Section>

							<Separator />

							{/* Language section */}
							<Dropdown.Section
								selectionMode='single'
								selectedKeys={new Set([`locale-${selectedLocaleKey}`])}
								onSelectionChange={onLocaleSelectionChange}
							>
								<Header>{tLang('switcher.label')}</Header>
								<Dropdown.Item
									key={`locale-${AUTO_LOCALE_KEY}`}
									id={`locale-${AUTO_LOCALE_KEY}`}
									textValue={autoLocaleLabel}
								>
									<Dropdown.ItemIndicator />
									<Label className={'inline-flex items-center gap-2'}>
										<span
											className={
												'material-icons-round text-[18px]! leading-none! text-gray-500'
											}
											aria-hidden={true}
										>
											{LOCALE_ICON.auto}
										</span>
										<span className={'leading-none'}>{autoLocaleLabel}</span>
									</Label>
								</Dropdown.Item>
								{LOCALES.map((l) => (
									<Dropdown.Item
										key={`locale-${l}`}
										id={`locale-${l}`}
										textValue={LOCALE_LABELS[l]}
									>
										<Dropdown.ItemIndicator />
										<Label className={'inline-flex items-center gap-2'}>
											<span
												className={
													'text-[14px] font-medium leading-none! text-gray-500 w-[18px] text-center shrink-0'
												}
												aria-hidden={true}
											>
												{LOCALE_ICON[l]}
											</span>
											<span className={'leading-none'}>{LOCALE_LABELS[l]}</span>
										</Label>
									</Dropdown.Item>
								))}
							</Dropdown.Section>

							<Separator />
						</>
					)}

					<Dropdown.Item
						id='docs'
						textValue={tCommon('docs')}
						href='https://docs.ham.nowcent.cn'
						target='_blank'
						rel='noopener noreferrer'
					>
						<Label className={'inline-flex items-center gap-2'}>
							<span
								className={
									'material-icons-round text-[18px]! leading-none! text-gray-500'
								}
								aria-hidden={true}
							>
								description
							</span>
							<span className={'leading-none'}>{tCommon('docs')}</span>
						</Label>
					</Dropdown.Item>

					<Separator />

					<Dropdown.Item
						id='logout'
						textValue={tCommon('logout')}
						variant='danger'
					>
						<Label>{tCommon('logout')}</Label>
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
};

export default UserMenu;
