/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/10 14:45:00
 *
 * Locator helpers shared by the page objects.
 *
 * HeroUI checkboxes wrap the native input behind an overlay that
 * intercepts pointer events, so `.check()` times out. {@link toggleIn}
 * clicks the surrounding row instead, which is what a user actually hits.
 *
 * Icon-only buttons are located by accessible name rather than glyph text:
 * every such button carries an `aria-label`, so `getByRole('button',
 * { name }) ` is both the stable handle and an implicit a11y assertion.
 */
import type { Locator, Page } from '@playwright/test';

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
