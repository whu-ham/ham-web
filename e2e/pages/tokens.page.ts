/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:57:00
 *
 * Page object for the API key management screen at /console/tokens.
 *
 * Wraps the list, the create/rotate modals and the revoke confirmation
 * popover. All HeroUI interaction quirks live in `locators.ts` so specs
 * read as intent rather than as DOM archaeology.
 */
import type { Locator, Page } from '@playwright/test';

export class TokensPage {
	readonly page: Page;
	readonly createButton: Locator;
	readonly emptyTitle: Locator;
	readonly retryButton: Locator;
	readonly loadingSpinner: Locator;

	constructor(page: Page) {
		this.page = page;
		this.createButton = page.getByRole('button', { name: 'Create Key' });
		this.emptyTitle = page.getByText('No API Keys yet');
		this.retryButton = page.getByRole('button', { name: 'Retry' });
		this.loadingSpinner = page.locator('[role="progressbar"]').first();
	}

	/** Navigate and wait for the header to settle. */
	async goto(): Promise<void> {
		await this.page.goto('/console/tokens');
		await this.page
			.getByRole('heading', { name: 'API Keys', level: 1 })
			.waitFor({ state: 'visible' });
	}

	/** Card for a token by its display name. */
	card(name: string): Locator {
		return this.page
			.locator('div.rounded-\\[12px\\]')
			.filter({ hasText: name })
			.first();
	}

	/** Open the create modal. */
	async openCreate(): Promise<TokenCreateModal> {
		await this.createButton.click();
		const modal = new TokenCreateModal(this.page);
		await modal.heading.waitFor({ state: 'visible' });
		return modal;
	}

	/** Open the rotate modal for the named token. */
	async openRotate(name: string): Promise<TokenRotateModal> {
		await this.cardButton(name, 'Rotate').click();
		const modal = new TokenRotateModal(this.page);
		await modal.heading.waitFor({ state: 'visible' });
		return modal;
	}

	/** Revoke the named token, confirming the popover. */
	async revoke(name: string): Promise<void> {
		const confirm = await this.openRevokeConfirm(name);
		await confirm.getByRole('button', { name: 'Revoke' }).click();
	}

	/** Cancel the revoke popover without deleting anything. */
	async cancelRevoke(name: string): Promise<void> {
		const confirm = await this.openRevokeConfirm(name);
		await confirm.getByRole('button', { name: 'Cancel' }).click();
	}

	/**
	 * Open the revoke confirmation for the named token and return the
	 * dialog. Both the card's trigger and the confirmation are labelled
	 * "Revoke", so every follow-up click must be scoped to the dialog.
	 */
	private async openRevokeConfirm(name: string): Promise<Locator> {
		await this.cardButton(name, 'Revoke').click();
		const confirm = this.page.getByRole('dialog');
		await confirm
			.getByText('Are you sure you want to revoke this key?')
			.waitFor({ state: 'visible' });
		return confirm;
	}

	/**
	 * A named action on a token card.
	 *
	 * Scoped to real `<button>` elements: HeroUI's Tooltip.Trigger also
	 * exposes `role="button"`, so `getByRole('button')` alone matches both
	 * the wrapper and the control inside it.
	 */
	private cardButton(name: string, label: string): Locator {
		return this.card(name).locator(`button[aria-label="${label}"]`);
	}

	/** Go back to /console via the header button. */
	async backToConsole(): Promise<void> {
		await this.page.getByRole('button', { name: 'Back to Console' }).click();
	}

	/** Number of token cards currently rendered. */
	async cardCount(): Promise<number> {
		return this.page.locator('div.rounded-\\[12px\\]').count();
	}
}

/** Create-token modal. */
export class TokenCreateModal {
	readonly heading: Locator;
	readonly nameInput: Locator;
	/** Spinner input for the TTL in days. */
	readonly ttlInput: Locator;
	readonly submitButton: Locator;
	readonly dialog: Locator;

	constructor(private readonly page: Page) {
		this.dialog = page.getByRole('dialog');
		this.heading = this.dialog.getByText('Create API Key');
		this.nameInput = this.dialog.getByRole('textbox').first();
		// HeroUI's NumberField renders a plain text input, so it cannot be
		// found by type or spinbutton role — its slot attribute can.
		this.ttlInput = this.dialog.locator('[data-slot="number-field-input"]');
		this.submitButton = this.dialog.getByRole('button', {
			name: 'Create',
			exact: true,
		});
	}

	/** Type a name, pick a scope label and submit. */
	async create(name: string, scopeLabel: string): Promise<void> {
		await this.nameInput.fill(name);
		await this.dialog.getByText(scopeLabel, { exact: true }).click();
		await this.submitButton.click();
	}

	/** Override the TTL (days) before submitting. */
	async setTtl(days: number): Promise<void> {
		await this.ttlInput.fill(String(days));
		await this.ttlInput.blur();
	}
}

/** Rotate-token modal. */
export class TokenRotateModal {
	readonly heading: Locator;
	readonly submitButton: Locator;
	readonly dialog: Locator;

	constructor(private readonly page: Page) {
		this.dialog = page.getByRole('dialog');
		this.heading = this.dialog.getByText('Rotate API Key');
		this.submitButton = this.dialog.getByRole('button', {
			name: 'Rotate',
			exact: true,
		});
	}

	async confirm(): Promise<void> {
		await this.submitButton.click();
	}
}

/** The one-time token reveal dialog shown after create/rotate. */
export class TokenRevealModal {
	readonly dialog: Locator;
	/** Read-only input holding the raw token value. */
	readonly valueInput: Locator;
	readonly copyButton: Locator;
	readonly closeButton: Locator;

	constructor(private readonly page: Page) {
		// Scoped by accessible name: the create/rotate modal can still be
		// mounted underneath while this one is open.
		this.dialog = page.getByRole('dialog', { name: 'Your API Key' });
		// The secret lives in a read-only input, so it is not part of the
		// dialog's text content and must be read as a form value.
		this.valueInput = this.dialog.locator('input').first();
		this.copyButton = this.dialog.getByRole('button', { name: 'Copy' });
		this.closeButton = this.dialog.getByRole('button', { name: 'Close' });
	}

	async waitFor(): Promise<void> {
		await this.dialog.waitFor({ state: 'visible' });
	}

	/** The revealed raw token value. */
	async value(): Promise<string> {
		return this.valueInput.inputValue();
	}

	async close(): Promise<void> {
		await this.closeButton.click();
	}
}
