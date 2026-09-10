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
		this.languageSwitcher = page
			.getByRole('button', { name: 'Change language' })
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
	async switchTheme(name: 'Light' | 'Dark'): Promise<void> {
		await this.themeSwitcher.click();
		await this.page.getByRole('menuitemradio', { name }).click();
	}

	/** Choose a language from the header switcher. */
	async switchLanguage(label: string): Promise<void> {
		await this.languageSwitcher.click();
		await this.page.getByRole('menuitemradio', { name: label }).click();
	}
}
