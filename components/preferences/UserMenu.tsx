/**
 * @author Claude
 * @version 1.4
 * @date 2026/5/22
 *
 * User menu dropdown with logout action.
 * In compact mode (mobile), also includes theme & language switching.
 *
 * M9 fix: Uses shared useThemePreference and useLocalePreference hooks
 * instead of duplicating logic from ThemeSwitcher and LanguageSwitcher.
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
import { useTranslations } from 'next-intl';

import { useLogout } from '@/hooks/useLogout';
import { LOCALES, LOCALE_LABELS, Locale, isLocale } from '@/i18n/config';
import {
	LOCALE_ICON,
	useLocalePreference,
	resolveAutoLabel,
} from '@/components/preferences/useLocalePreference';
import { THEMES, Theme, isTheme } from '@/components/theme/config';
import {
	THEME_ICON,
	useThemePreference,
} from '@/components/preferences/useThemePreference';

const AUTO_THEME_KEY = 'auto' as const;
type ThemeKey = typeof AUTO_THEME_KEY | Theme;

const AUTO_LOCALE_KEY = 'auto' as const;

interface UserMenuProps {
	/** Override the default logout handler */
	onLogout?: () => void;
	/** When true, includes theme & language options in the dropdown */
	compact?: boolean;
}

const UserMenu = ({ onLogout, compact }: UserMenuProps) => {
	const defaultLogout = useLogout();
	const handleLogout = onLogout ?? defaultLogout;
	const tCommon = useTranslations('common');
	const tTheme = useTranslations('theme');
	const tLang = useTranslations('language');

	const { selectedKey: selectedThemeKey, onSelectionChange: onThemeChange } =
		useThemePreference();
	const { selectedKey: selectedLocaleKey, browserLocale, onSelectionChange: onLocaleChange } =
		useLocalePreference();

	const onThemeSelectionChange = (keys: Selection) => {
		const rawKey = Array.from(keys)[0]?.toString();
		if (!rawKey) return;
		const key = rawKey.replace(/^theme-/, '');
		onThemeChange(key);
	};

	const onLocaleSelectionChange = (keys: Selection) => {
		const rawKey = Array.from(keys)[0]?.toString();
		if (!rawKey) return;
		const key = rawKey.replace(/^locale-/, '');
		onLocaleChange(key);
	};

	const autoLocaleLabel = resolveAutoLabel(
		browserLocale,
		tLang('switcher.auto')
	);

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
				<Dropdown.Menu onAction={(key) => key === 'logout' && handleLogout()}>
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
