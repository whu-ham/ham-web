/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/21 12:43:48
 *
 * Shared top-right header bar used by every /sso-authorize view.
 *
 * Why a dedicated component:
 *   - All four sub-views (LoginView, DeepLinkTrying, DeepLinkFallback,
 *     InvalidRequestView) need the same pair of switchers in the same
 *     spot, and previously each inlined an identical `absolute` wrapper.
 *   - When the viewport is short the card content sits right under the
 *     switchers; without a backdrop they become unreadable. A frosted
 *     pill (backdrop-blur + translucent surface + hairline border)
 *     solves both cases — it's invisible-ish over solid backgrounds and
 *     becomes a readable glass layer when card content scrolls behind.
 *
 * Positioning:
 *   - `fixed` (not `absolute`) so the bar stays put even when the card
 *     pushes the page taller than the viewport. The safe-area env()
 *     offsets keep it clear of iOS notches / dynamic islands.
 *   - z-50 keeps it above HeroUI dropdowns / dialogs on the card
 *     (which are portaled at z-40 or below).
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
