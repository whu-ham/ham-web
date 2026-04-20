/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/20
 *
 * Dark-mode toggle for HeroUI v3 modeled after `LanguageSwitcher`.
 * The trigger is deliberately icon-only to keep the SSO header
 * uncluttered, while each dropdown entry pairs its Material Icon
 * with a localized label so the tri-state choice (auto / light /
 * dark) stays self-describing for both screen-reader and sighted
 * users.
 *
 * Resolution policy (aligned with `theme/config.ts`):
 *   - Default option is "Follow system" (`auto`). When selected we
 *     DELETE the `NEXT_THEME` cookie and let
 *     `prefers-color-scheme` decide on every subsequent paint.
 *   - When the user picks a concrete theme we persist it in
 *     `NEXT_THEME` (cookie + localStorage) as an explicit override.
 *   - The `<html>` element carries BOTH `class="light|dark"` and
 *     `data-theme="light|dark"`, per the HeroUI v3 Colors guide, so
 *     Tailwind's `dark:` variant and HeroUI's own
 *     `[data-theme]` selectors stay in sync.
 *
 * The theme is applied client-side on every preference change and
 * every system-preference change (when in auto mode). There is no
 * server round-trip because theme affects presentation only, so we
 * skip `router.refresh()` to avoid losing the SSO page's OAuth query
 * state.
 */
'use client';

import { Dropdown, Label, buttonVariants } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { Key, useCallback, useEffect, useSyncExternalStore } from 'react';

import {
	THEMES,
	THEME_CLASSES,
	THEME_COOKIE,
	Theme,
	isTheme,
} from '@/components/theme/config';

interface ThemeSwitcherProps {
	className?: string;
}

const AUTO_KEY = 'auto' as const;

type MenuKey = typeof AUTO_KEY | Theme;

// Material Icons glyph per menu entry. Using the round family to
// match the rest of the app (see `language` icon in
// `LanguageSwitcher`).
const THEME_ICON: Record<MenuKey, string> = {
	auto: 'brightness_auto',
	light: 'light_mode',
	dark: 'dark_mode',
};

/**
 * Reads `NEXT_THEME` directly off `document.cookie`. Cheap enough
 * that pulling in `js-cookie` here would be overkill.
 */
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

/**
 * Resolves the theme that CSS `prefers-color-scheme` is currently
 * advertising. Returns `light` on the server / in browsers that
 * don't expose `matchMedia` so the resolved theme is always a
 * concrete value.
 */
const detectSystemTheme = (): Theme => {
	if (typeof window === 'undefined' || !window.matchMedia) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
};

/**
 * Writes BOTH `class="light|dark"` and `data-theme="light|dark"` on
 * `<html>`. The HeroUI v3 Colors guide explicitly names both hooks,
 * so covering both ensures user stylesheets targeting either
 * convention keep working regardless of which one they prefer.
 */
const applyThemeToDocument = (resolved: Theme) => {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	const other: Theme = resolved === 'dark' ? 'light' : 'dark';
	root.classList.remove(THEME_CLASSES[other]);
	root.classList.add(THEME_CLASSES[resolved]);
	root.setAttribute('data-theme', resolved);
	// `color-scheme` lets the UA pick sensible defaults for scrollbars
	// and form controls without per-element theming.
	root.style.colorScheme = resolved;
};

const ThemeSwitcher = ({ className }: ThemeSwitcherProps) => {
	const t = useTranslations('theme');

	// Cookie snapshot. On the server there is no cookie to read, so
	// we return `null` ("no override → follow system"). The first
	// client render corrects this if the cookie is actually present.
	const override = useSyncExternalStore(
		subscribeNoop,
		getOverrideSnapshot,
		getOverrideServerSnapshot
	);

	// System preference snapshot. Unlike the cookie, this has a real
	// change source (`matchMedia(...).addEventListener('change')`), so
	// we wire the subscriber up properly to re-render on OS-level
	// light/dark switches when the user is in auto mode.
	const systemTheme = useSyncExternalStore(
		subscribeSystemTheme,
		getSystemThemeSnapshot,
		getSystemThemeServerSnapshot
	);

	const selectedKey: MenuKey = override ?? AUTO_KEY;
	const resolvedTheme: Theme = override ?? systemTheme;

	// Apply the resolved theme on every change. This is idempotent —
	// `applyThemeToDocument` only flips two class names + one attribute,
	// and React will skip the effect when the deps are unchanged.
	useEffect(() => {
		applyThemeToDocument(resolvedTheme);
	}, [resolvedTheme]);

	const writeOverride = useCallback((next: Theme) => {
		document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
		try {
			window.localStorage.setItem(THEME_COOKIE, next);
		} catch {
			// Ignore — private mode may block storage access.
		}
	}, []);

	const clearOverride = useCallback(() => {
		document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
		try {
			window.localStorage.removeItem(THEME_COOKIE);
		} catch {
			// Ignore — private mode may block storage access.
		}
	}, []);

	const onAction = (rawKey: Key) => {
		const key = String(rawKey);
		if (key === AUTO_KEY) {
			if (override === null) return;
			clearOverride();
		} else if (isTheme(key)) {
			if (override === key) return;
			writeOverride(key);
		} else {
			return;
		}
		// Kick the external-store subscribers so the component
		// re-reads the cookie we just mutated. `useSyncExternalStore`
		// only re-runs its getter on subscription events, so we
		// dispatch a storage-like event manually. We piggy-back on
		// `window`'s own event bus to keep the contract symmetric
		// with the `subscribeNoop` helper (no external bus needed).
		window.dispatchEvent(new Event('ham:theme-change'));
	};

	const triggerIcon = THEME_ICON[selectedKey];

	return (
		<Dropdown>
			<Dropdown.Trigger
				aria-label={t('switcher.ariaLabel')}
				className={buttonVariants({
					size: 'sm',
					variant: 'tertiary',
					isIconOnly: true,
					className: `inline-flex items-center justify-center ${className ?? ''}`,
				})}
			>
				<span
					className={
						'material-icons-round !text-[18px] !leading-none text-gray-500'
					}
					aria-hidden={true}
				>
					{triggerIcon}
				</span>
			</Dropdown.Trigger>
			<Dropdown.Popover placement={'bottom end'}>
				<Dropdown.Menu
					aria-label={t('switcher.ariaLabel')}
					selectedKeys={new Set([selectedKey])}
					selectionMode={'single'}
					onAction={onAction}
				>
					{(['auto', ...THEMES] as const).map((key) => {
						const label =
							key === AUTO_KEY ? t('switcher.auto') : t(`switcher.${key}`);
						return (
							<Dropdown.Item key={key} id={key} textValue={label}>
								<Label className={'inline-flex items-center gap-2'}>
									<span
										className={
											'material-icons-round !text-[18px] !leading-none text-gray-500'
										}
										aria-hidden={true}
									>
										{THEME_ICON[key]}
									</span>
									<span className={'leading-none'}>{label}</span>
								</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
						);
					})}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
};

export default ThemeSwitcher;

// --- useSyncExternalStore helpers ------------------------------------

/**
 * Cookie subscribers. `onAction` dispatches `ham:theme-change` after
 * mutating the cookie, which re-runs `getOverrideSnapshot` and
 * flushes the new selection to subscribers.
 */
const subscribeNoop = (onChange: () => void) => {
	if (typeof window === 'undefined') return () => {};
	window.addEventListener('ham:theme-change', onChange);
	// Cross-tab sync: another tab writing to localStorage should also
	// invalidate our snapshot.
	window.addEventListener('storage', onChange);
	return () => {
		window.removeEventListener('ham:theme-change', onChange);
		window.removeEventListener('storage', onChange);
	};
};

const getOverrideSnapshot = (): Theme | null => readThemeCookie();
// Server snapshot: assume "no override" so the initial paint follows
// whatever the inline bootstrap (or the browser default) rendered.
const getOverrideServerSnapshot = (): Theme | null => null;

/**
 * System-theme subscriber. `matchMedia(...).addEventListener('change')`
 * fires whenever the OS flips between light and dark, so we can keep
 * auto mode reactive without polling.
 */
const subscribeSystemTheme = (onChange: () => void) => {
	if (typeof window === 'undefined' || !window.matchMedia) return () => {};
	const mql = window.matchMedia('(prefers-color-scheme: dark)');
	mql.addEventListener('change', onChange);
	return () => mql.removeEventListener('change', onChange);
};

const getSystemThemeSnapshot = (): Theme => detectSystemTheme();
const getSystemThemeServerSnapshot = (): Theme => 'light';
