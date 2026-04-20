/**
 * @author Claude
 * @version 2.1
 * @date 2026/4/20
 *
 * Language switcher rewritten for HeroUI v3. The v3 `Dropdown` is a
 * compound component built on React Aria Components; selection uses
 * `Dropdown.Menu` + `selectedKeys` + `selectionMode="single"`, and we
 * render a `Dropdown.ItemIndicator` per item to surface the check mark
 * that the v2 implementation drew manually.
 *
 * Policy (aligned with `i18n/request.ts`):
 *   - Default option is "Follow browser" (`auto`). When selected we
 *     DELETE the `NEXT_LOCALE` cookie so the server resolves the
 *     active language from the `Accept-Language` header on every
 *     request.
 *   - The "Follow browser" label is always rendered in the BROWSER's
 *     own language — not the currently-active UI language — so a
 *     user whose browser is set to Japanese always sees the Japanese
 *     wording for that option regardless of which language the app
 *     is currently showing. This is the behaviour users expect from
 *     OS-level language pickers.
 *   - When the user picks a specific language we persist it in
 *     `NEXT_LOCALE` (cookie + localStorage) as an explicit override
 *     that survives across requests.
 *   - The currently-highlighted menu entry is derived from whether
 *     the cookie is present: cookie missing → "auto", cookie set →
 *     matching concrete locale. This keeps the UI state honest with
 *     the server-side resolution pipeline.
 */
'use client';

import { Dropdown, Label, buttonVariants } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Key, useSyncExternalStore, useTransition } from 'react';

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

interface LanguageSwitcherProps {
	className?: string;
}

const AUTO_KEY = 'auto' as const;

type MenuKey = typeof AUTO_KEY | Locale;

/**
 * Static map of catalogues keyed by locale, used to render the
 * "Follow browser" wording in the browser's own language. The three
 * JSON files are already part of the client bundle via `next-intl`,
 * so referencing them here only costs an extra import statement, not
 * an extra network request.
 */
const LOCALE_MESSAGES: Record<Locale, typeof enMessages> = {
	zh: zhMessages,
	en: enMessages,
	ja: jaMessages,
};

/**
 * Resolve the "Follow browser" label in the BROWSER's own language.
 *   - When `browserLocale` is a supported language, render the
 *     `autoWithDetected` entry from THAT language's catalogue with
 *     the detected language's native name interpolated in.
 *   - When `browserLocale` is `null` (SSR snapshot, or the browser
 *     advertised nothing we support), the caller decides what to
 *     render — we return the active-locale `auto` fallback so SSR
 *     output stays stable and the client can override post-hydration.
 */
const resolveAutoLabel = (
	browserLocale: Locale | null,
	activeLocaleFallback: string
): string => {
	if (!browserLocale) return activeLocaleFallback;
	const catalogue = LOCALE_MESSAGES[browserLocale].language.switcher;
	return catalogue.autoWithDetected.replace(
		'{detected}',
		LOCALE_LABELS[browserLocale]
	);
};

/**
 * Best-effort match of the browser's preferred language against our
 * supported catalogue. Returns `null` if the browser doesn't advertise
 * any language we support — in that case the server still falls back
 * to `DEFAULT_LOCALE`.
 */
const detectBrowserLocale = (): Locale | null => {
	if (typeof navigator === 'undefined') return null;
	const candidates: string[] = [];
	if (Array.isArray(navigator.languages)) {
		candidates.push(...navigator.languages);
	}
	if (navigator.language) {
		candidates.push(navigator.language);
	}
	for (const raw of candidates) {
		const tag = raw.toLowerCase();
		if (isLocale(tag)) return tag;
		const base = tag.split('-')[0];
		if (isLocale(base)) return base;
	}
	return null;
};

/**
 * Reads `NEXT_LOCALE` straight off `document.cookie`. We can't import
 * `js-cookie` here because the cookie may be missing entirely, and a
 * bare regex is cheap enough.
 */
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

const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
	const router = useRouter();
	const currentLocale = useLocale() as Locale;
	const [isPending, startTransition] = useTransition();
	const t = useTranslations('language');

	// Snapshot cookie + browser language from the real environment.
	// On the server there is no `document`/`navigator`, so we fall
	// back to "override present" + "browser unknown" — this matches
	// the concrete locale the server resolved and avoids a hydration
	// mismatch. Subscribers are a no-op: cookie changes we make
	// ourselves are followed by `router.refresh()`, which forces a
	// re-render and gives `useSyncExternalStore` a fresh snapshot.
	const hasOverride = useSyncExternalStore(
		subscribeNoop,
		getCookieSnapshot,
		getCookieServerSnapshot
	);
	const browserLocale = useSyncExternalStore(
		subscribeNoop,
		getBrowserLocaleSnapshot,
		getBrowserLocaleServerSnapshot
	);

	const selectedKey: MenuKey = hasOverride ? currentLocale : AUTO_KEY;

	const writeOverride = (next: Locale) => {
		// 1 year expiry — this is a UX preference, not a security
		// token. `SameSite=Lax` is fine: the locale cookie is already
		// sent on same-site navigations and we explicitly do not want
		// to leak it to embedded third-party frames.
		document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
		try {
			window.localStorage.setItem(LOCALE_COOKIE, next);
		} catch {
			// Ignore — private mode may block storage access.
		}
	};

	const clearOverride = () => {
		document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
		try {
			window.localStorage.removeItem(LOCALE_COOKIE);
		} catch {
			// Ignore — private mode may block storage access.
		}
	};

	const onAction = (rawKey: Key) => {
		const key = String(rawKey);

		if (key === AUTO_KEY) {
			// User switched to "Follow browser" — drop the override and
			// let the server resolve from `Accept-Language`.
			if (!hasOverride) return;
			clearOverride();
		} else if (isLocale(key)) {
			if (!hasOverride && key === currentLocale) {
				// Already in this language via auto-detect; nothing to
				// persist.
				return;
			}
			writeOverride(key);
		} else {
			return;
		}

		startTransition(() => {
			// `router.refresh()` re-runs Server Components and picks up
			// the new cookie state without changing the URL. We keep
			// the query string intact so the SSO consent page does not
			// lose its OAuth params mid-flow.
			router.refresh();
		});
	};

	// Compose the "Follow browser" entry label. Two behaviours are
	// stacked here:
	//   1. The wording itself is rendered in the BROWSER's own
	//      language (see `resolveAutoLabel`). A user running a
	//      Japanese browser but currently viewing the English UI
	//      still sees "ブラウザに従う" here — this matches how OS
	//      language pickers behave.
	//   2. When we can detect a supported browser language we append
	//      its native name in parentheses so the user can tell which
	//      concrete language they'd end up in; when the browser
	//      advertises no supported language we render the
	//      "unsupported" hint so they know why picking `auto` would
	//      still land them on the fallback.
	const autoLabel = resolveAutoLabel(browserLocale, t('switcher.auto'));
	// When the browser advertises no supported language, fall through
	// to the active-locale "unsupported" string — showing an
	// untranslated "Follow browser (unsupported)" in a Chinese UI
	// would feel more broken than not honouring the "browser-
	// language" rule for this single edge case.
	const autoTriggerLabel =
		browserLocale === null ? t('switcher.autoUnsupported') : autoLabel;

	// Text shown on the trigger button — mirrors the currently active
	// locale (or the auto-detect marker) so the component can double
	// as a "current language" indicator without needing a separate
	// caption.
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
					className: `inline-flex items-center justify-center gap-2 ${className ?? ''}`,
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
				{/*
				 * Hide the text label on narrow viewports (< 640px)
				 * so the trigger collapses to an icon-only button
				 * next to the ThemeSwitcher inside the HeaderBar.
				 * The dropdown menu itself still renders full text
				 * entries, and the `aria-label` on the trigger
				 * preserves accessibility.
				 */}
				<span className={'leading-none hidden sm:inline'}>{triggerLabel}</span>
			</Dropdown.Trigger>
			<Dropdown.Popover placement={'bottom end'}>
				<Dropdown.Menu
					aria-label={t('switcher.ariaLabel')}
					selectedKeys={new Set([selectedKey])}
					selectionMode={'single'}
					// `onAction` fires for both keyboard and mouse
					// activation; `onSelectionChange` would fire on every
					// Set mutation which is noisier for a single-select
					// menu.
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

// --- useSyncExternalStore helpers ------------------------------------

// No external event source exists for cookies/`navigator.language`
// in the browser — we mutate them ourselves and immediately follow
// with `router.refresh()`, which is what actually drives the re-render.
// A no-op subscriber is therefore both sufficient and required by the
// `useSyncExternalStore` signature.
const subscribeNoop = () => () => {};

const getCookieSnapshot = (): boolean => readLocaleCookie() !== null;
// The server has no way to tell whether the user has a cookie yet —
// assume "override present" so the trigger's initial label mirrors
// the concrete locale the server picked. The first post-hydration
// snapshot on the client corrects this if the cookie is missing.
const getCookieServerSnapshot = (): boolean => true;

const getBrowserLocaleSnapshot = (): Locale | null => detectBrowserLocale();
const getBrowserLocaleServerSnapshot = (): Locale | null => null;
