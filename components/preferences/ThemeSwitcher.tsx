/**
 * @author Claude
 * @version 1.3
 * @date 2026/9/23 01:02:47
 *
 * Dark-mode toggle for HeroUI v3 modeled after `LanguageSwitcher`.
 *
 * M9 fix: Theme logic extracted to useThemePreference hook, shared with UserMenu.
 */
'use client';

import type { Selection } from '@heroui/react';

import { Dropdown, Label, buttonVariants } from '@heroui/react';
import { useTranslations } from 'next-intl';

import { THEMES } from '@/components/theme/config';
import {
	THEME_ICON,
	useThemePreference,
} from '@/components/preferences/useThemePreference';

interface ThemeSwitcherProps {
	className?: string;
}

const AUTO_KEY = 'auto' as const;

const ThemeSwitcher = ({ className }: ThemeSwitcherProps) => {
	const t = useTranslations('theme');
	const { selectedKey, onSelectionChange } = useThemePreference();

	const onMenuSelectionChange = (keys: Selection) => {
		const key = Array.from(keys)[0]?.toString();
		if (!key) return;
		onSelectionChange(key);
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
						'material-icons-round text-[18px]! leading-none! text-muted'
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
					onSelectionChange={onMenuSelectionChange}
				>
					{(['auto', ...THEMES] as const).map((key) => {
						const label =
							key === AUTO_KEY ? t('switcher.auto') : t(`switcher.${key}`);
						return (
							<Dropdown.Item key={key} id={key} textValue={label}>
								<Dropdown.ItemIndicator />
								<Label className={'inline-flex items-center gap-2'}>
									<span
										className={
											'material-icons-round text-[18px]! leading-none! text-muted'
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
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
};

export default ThemeSwitcher;
