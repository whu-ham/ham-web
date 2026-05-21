/**
 * @author Claude
 * @version 1.4
 * @date 2026/5/22
 *
 * Shared top-right header bar — floating pill variant.
 * Only used on pages without a page-level header (e.g. login views).
 *
 * For authenticated pages, toolbar items are integrated directly
 * into the page header instead of using this floating component.
 */
'use client';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const HeaderBar = () => {
	return (
		<div
			className={
				'fixed z-50 flex items-center gap-1 rounded-full ' +
				'bg-surface/60 backdrop-blur-md ' +
				'border border-border/60 ' +
				'px-1.5 py-1 ' +
				'top-[max(1rem,env(safe-area-inset-top))] ' +
				'right-[max(1rem,env(safe-area-inset-right))]'
			}
		>
			<ThemeSwitcher />
			<LanguageSwitcher />
		</div>
	);
};

export default HeaderBar;
