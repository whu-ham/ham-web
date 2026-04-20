/**
 * @author Claude
 * @version 2.2
 * @date 2026/4/20 19:22:58
 */
'use client';

import { Dropdown, Label, buttonVariants } from '@heroui/react';
import { useAtom } from 'jotai';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Key, useTransition } from 'react';

import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import zhMessages from '@/messages/zh.json';
import {
	LOCALES,
	LOCALE_COOKIE,
	LOCALE_LABELS,
	Locale,
	isLocale,
} from '@/i18n/config';
import { localeOverrideAtom } from '@/store/localeAtom';

interface LanguageSwitcherProps {
	className?: string;
}

const AUTO_KEY = 'auto' as const;
type MenuKey = typeof AUTO_KEY | Locale;

const LOCALE_MESSAGES: Record<Locale, typeof enMessages> = {
	zh: zhMessages,
	en: enMessages,
	ja: jaMessages,
};

// --- Helpers --------------------------------------------------------

/**
 * Best-effort match of the browser's preferred language against our
 * supported catalogue.
 */
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

/**
 * Resolve the "Follow browser" label in the browser's own language.
 */
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

// --- Cookie helpers -------------------------------------------------

const writeLocaleCookie = (locale: Locale) => {
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
	try {
		window.localStorage.setItem(LOCALE_COOKIE, locale);
	} catch {
		// Ignore — private mode may block storage access.
	}
};

const clearLocaleCookie = () => {
	document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
	try {
		window.localStorage.removeItem(LOCALE_COOKIE);
	} catch {
		// Ignore — private mode may block storage access.
	}
};

// --- Component ------------------------------------------------------

const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
	const router = useRouter();
	const currentLocale = useLocale() as Locale;
	const [isPending, startTransition] = useTransition();
	const t = useTranslations('language');

	const [hasOverride, setHasOverride] = useAtom(localeOverrideAtom);

	// Detect browser locale once on the client (no SSR value needed).
	const browserLocale =
		typeof navigator !== 'undefined' ? detectBrowserLocale() : null;

	const selectedKey: MenuKey = hasOverride ? currentLocale : AUTO_KEY;

	const onAction = (rawKey: Key) => {
		const key = String(rawKey);

		if (key === AUTO_KEY) {
			if (!hasOverride) return;
			clearLocaleCookie();
			setHasOverride(false);
		} else if (isLocale(key)) {
			if (!hasOverride && key === currentLocale) return;
			writeLocaleCookie(key);
			setHasOverride(true);
		} else {
			return;
		}

		startTransition(() => {
			router.refresh();
		});
	};

	const autoLabel = resolveAutoLabel(browserLocale, t('switcher.auto'));
	const autoTriggerLabel =
		browserLocale === null ? t('switcher.autoUnsupported') : autoLabel;
	const triggerLabel = hasOverride
		? LOCALE_LABELS[currentLocale]
		: autoTriggerLabel;

	return (
		<Dropdown>
			<Dropdown.Trigger
				aria-label={t('switcher.ariaLabel')}
				className={buttonVariants({
					size: 'sm',
					variant: 'tertiary',
					isIconOnly: true,
					className: `inline-flex items-center justify-center sm:w-auto sm:gap-2 sm:px-3 ${className ?? ''}`,
				})}
				isDisabled={isPending}
			>
				<span
					className={
						'material-icons-round !text-[18px] !leading-none text-gray-500'
					}
					aria-hidden={true}
				>
					language
				</span>
				<span className={'leading-none hidden sm:inline'}>{triggerLabel}</span>
			</Dropdown.Trigger>
			<Dropdown.Popover placement={'bottom end'}>
				<Dropdown.Menu
					aria-label={t('switcher.ariaLabel')}
					selectedKeys={new Set([selectedKey])}
					selectionMode={'single'}
					onAction={onAction}
				>
					<Dropdown.Item id={AUTO_KEY} textValue={autoTriggerLabel}>
						<Label>{autoTriggerLabel}</Label>
						<Dropdown.ItemIndicator />
					</Dropdown.Item>
					{LOCALES.map((l) => (
						<Dropdown.Item key={l} id={l} textValue={LOCALE_LABELS[l]}>
							<Label>{LOCALE_LABELS[l]}</Label>
							<Dropdown.ItemIndicator />
						</Dropdown.Item>
					))}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
};

export default LanguageSwitcher;
