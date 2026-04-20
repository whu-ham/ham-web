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
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { Key, useEffect } from 'react';

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

interface ThemeSwitcherProps {
	className?: string;
}

const AUTO_KEY = 'auto' as const;
type MenuKey = typeof AUTO_KEY | Theme;

const THEME_ICON: Record<MenuKey, string> = {
	auto: 'brightness_auto',
	light: 'light_mode',
	dark: 'dark_mode',
};

/**
 * Writes BOTH `class="light|dark"` and `data-theme="light|dark"` on
 * `<html>`. HeroUI v3 requires both hooks.
 */
const applyThemeToDocument = (resolved: Theme) => {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	const other: Theme = resolved === 'dark' ? 'light' : 'dark';
	root.classList.remove(THEME_CLASSES[other]);
	root.classList.add(THEME_CLASSES[resolved]);
	root.setAttribute('data-theme', resolved);
	root.style.colorScheme = resolved;
};

const ThemeSwitcher = ({ className }: ThemeSwitcherProps) => {
	const t = useTranslations('theme');

	const [override, setOverride] = useAtom(themeOverrideAtom);
	const setSystemTheme = useSetAtom(systemThemeAtom);
	const resolvedTheme = useAtomValue(resolvedThemeAtom);

	// Keep systemThemeAtom in sync with the OS preference.
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => setSystemTheme(mql.matches ? 'dark' : 'light');
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	}, [setSystemTheme]);

	// Apply the resolved theme to the document on every change.
	useEffect(() => {
		applyThemeToDocument(resolvedTheme);
	}, [resolvedTheme]);

	const selectedKey: MenuKey = override ?? AUTO_KEY;

	const onAction = (rawKey: Key) => {
		const key = String(rawKey);
		if (key === AUTO_KEY) {
			setOverride(null);
		} else if (isTheme(key)) {
			setOverride(key);
		}
	};

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
					{THEME_ICON[selectedKey]}
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
