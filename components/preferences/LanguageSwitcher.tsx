/**
 * @author Claude
 * @version 2.6
 * @date 2026/4/21 19:56:00
 *
 * M9 fix: Locale logic extracted to useLocalePreference hook, shared with UserMenu.
 */
'use client';

import { Dropdown, Label, buttonVariants } from '@heroui/react';
import type { Selection } from '@heroui/react';
import { useTranslations } from 'next-intl';

import { LOCALES, LOCALE_LABELS, Locale, isLocale } from '@/i18n/config';
import {
	LOCALE_ICON,
	useLocalePreference,
	resolveAutoLabel,
} from '@/components/preferences/useLocalePreference';

interface LanguageSwitcherProps {
	className?: string;
}

const AUTO_KEY = 'auto' as const;
type MenuKey = typeof AUTO_KEY | Locale;

const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
	const t = useTranslations('language');

	const { selectedKey, browserLocale, onSelectionChange } =
		useLocalePreference();

	const onMenuSelectionChange = (keys: Selection) => {
		const rawKey = Array.from(keys)[0]?.toString();
		if (!rawKey) return;
		onSelectionChange(rawKey);
	};

	const autoLabel = resolveAutoLabel(browserLocale, t('switcher.auto'));
	const autoTriggerLabel =
		browserLocale === null ? t('switcher.autoUnsupported') : autoLabel;
	const triggerLabel =
		selectedKey !== AUTO_KEY ? LOCALE_LABELS[selectedKey as Locale] : autoTriggerLabel;

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
			>
				<span
					className={
						'material-icons-round text-[18px]! leading-none! text-gray-500'
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
					onSelectionChange={onMenuSelectionChange}
				>
					<Dropdown.Item id={AUTO_KEY} textValue={autoTriggerLabel}>
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
							<span className={'leading-none'}>{autoTriggerLabel}</span>
						</Label>
					</Dropdown.Item>
					{LOCALES.map((l) => (
						<Dropdown.Item key={l} id={l} textValue={LOCALE_LABELS[l]}>
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
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
};

export default LanguageSwitcher;
