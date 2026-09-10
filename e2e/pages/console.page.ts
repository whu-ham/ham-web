/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:57:00
 *
 * Page object for the authenticated console at /console.
 */
import type { Locator, Page } from '@playwright/test';

export class ConsolePage {
	readonly page: Page;
	readonly greeting: Locator;
	readonly apiKeyCard: Locator;
	readonly themeSwitcher: Locator;
	readonly languageSwitcher: Locator;
	readonly menuTrigger: Locator;

	constructor(page: Page) {
		this.page = page;
		this.greeting = page.getByRole('heading', { level: 1 });
		this.apiKeyCard = page.getByRole('button', {
			name: /API Key Management/,
		});
		this.themeSwitcher = page
			.getByRole('button', { name: 'Change theme' })
			.first();
		// Located by slot, not by accessible name: the switchers' labels
		// come from i18n, so they change once the locale changes and a
		// name-based lookup would stop matching mid-test.
		this.languageSwitcher = page
			.locator('[data-slot="dropdown-trigger"]')
			.filter({ hasText: 'language' })
			.first();
		// The header renders two user menus (compact and full) and hides
		// one via CSS, so the visible one must be picked explicitly.
		this.menuTrigger = page
			.getByRole('button', { name: 'Menu' })
			.locator('visible=true')
			.first();
	}

	async goto(): Promise<void> {
		await this.page.goto('/console');
		await this.greeting.waitFor({ state: 'visible' });
	}

	/** Click the API key feature card, landing on /console/tokens. */
	async openApiKeys(): Promise<void> {
		await this.apiKeyCard.click();
	}

	/**
	 * Open the user dropdown and choose Sign out.
	 *
	 * `useLogout` pushes '/' and lets the server re-decide, so the
	 * landing page depends on whether the session cookie survives.
	 */
	async logout(): Promise<void> {
		await this.menuTrigger.click();
		await this.page.getByRole('menuitem', { name: 'Sign out' }).click();
	}

	/** Choose a theme from the header switcher. */
	async switchTheme(name: 'Light' | 'Dark' | 'Follow system'): Promise<void> {
		await this.themeSwitcher.click();
		await this.menuOption(name).click();
	}

	/**
	 * Choose a language from the header switcher.
	 *
	 * Waits for the greeting to settle afterwards: switching locale
	 * re-renders the whole page, so acting on a locator captured before
	 * the switch can hit a detached node.
	 */
	async switchLanguage(label: string): Promise<void> {
		await this.languageSwitcher.click();
		await this.menuOption(label).click();
		// Switching locale re-renders the whole page, so the next action
		// must wait rather than reuse a locator from before the switch.
		await this.greeting.waitFor({ state: 'visible' });
	}

	/**
	 * An option inside an open switcher menu.
	 *
	 * Matched by substring: each option renders its Material glyph before
	 * the label (e.g. "AEnglish"), so the accessible name is the
	 * concatenation and an exact match would never hold.
	 */
	private menuOption(label: string): Locator {
		return this.page
			.getByRole('menuitemradio')
			.filter({ hasText: new RegExp(label, 'i') })
			.first();
	}
}
