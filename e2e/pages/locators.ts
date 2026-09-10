/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:57:00
 *
 * Locator helpers shared by the page objects.
 *
 * HeroUI renders icon-only buttons, whose glyph sits in an
 * `aria-hidden` span — so `getByRole('button', { name: 'delete_outline' })`
 * never matches. {@link iconButton} targets the glyph text directly, which
 * is the only stable handle those controls expose.
 *
 * HeroUI checkboxes likewise wrap the native input behind an overlay that
 * intercepts pointer events, so `.check()` times out. {@link toggleIn}
 * clicks the surrounding row instead, which is what a user actually hits.
 */
import type { Locator, Page } from '@playwright/test';

/** Icon-only button identified by its Material glyph name. */
export const iconButton = (scope: Page | Locator, glyph: string): Locator =>
	scope.locator('button', { hasText: glyph }).first();

/**
 * Toggle a scope/consent checkbox by clicking its label row.
 * The native input is unreachable, so we drive the visible control.
 */
export const toggleIn = async (
	scope: Page | Locator,
	label: string
): Promise<void> => {
	const row = scope
		.locator('label, [data-slot="checkbox"]')
		.filter({ hasText: label })
		.first();
	await row.click();
};

/** True when a HeroUI checkbox row is in the checked state. */
export const isCheckedIn = async (
	scope: Page | Locator,
	label: string
): Promise<boolean> => {
	const row = scope
		.locator('label, [data-slot="checkbox"]')
		.filter({ hasText: label })
		.first();
	const input = row.locator('input[type="checkbox"]').first();
	if ((await input.count()) === 0) return false;
	return input.isChecked();
};
