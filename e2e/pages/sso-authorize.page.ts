/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:57:00
 *
 * Page object for the SSO consent screen at /sso-authorize.
 *
 * The page has four distinct outcomes (invalid request, desktop redirect
 * to login, mobile deep-link fallback, and consent), so this object
 * exposes the elements of each rather than assuming one renders.
 */
import type { Locator, Page } from '@playwright/test';

export class SsoAuthorizePage {
	readonly page: Page;
	readonly invalidTitle: Locator;
	readonly tryingTitle: Locator;
	readonly fallbackTitle: Locator;
	readonly downloadButton: Locator;
	readonly signInBrowserButton: Locator;
	readonly appName: Locator;
	readonly authorizeButton: Locator;
	readonly rejectButton: Locator;
	readonly switchAccount: Locator;
	readonly previouslyAuthorized: Locator;
	readonly errorTitle: Locator;
	readonly backToThirdParty: Locator;

	constructor(page: Page) {
		this.page = page;
		this.invalidTitle = page.getByRole('heading', { name: 'Invalid request' });
		this.tryingTitle = page.getByRole('heading', {
			name: 'Continuing in Ham',
		});
		this.fallbackTitle = page.getByRole('heading', {
			name: 'Ham not detected',
		});
		this.downloadButton = page.getByRole('button', {
			name: /Download Ham|App Store/,
		});
		this.signInBrowserButton = page.getByRole('button', {
			name: 'Sign in with browser',
		});
		this.appName = page.getByRole('heading', { name: 'Stub App' });
		this.authorizeButton = page.getByRole('button', { name: 'Authorize' });
		this.rejectButton = page.getByRole('button', { name: 'Reject' });
		this.switchAccount = page.getByText('Switch account');
		this.previouslyAuthorized = page.getByText(
			"You've previously authorized this app"
		);
		this.errorTitle = page.getByRole('heading', {
			name: 'Authorization failed',
		});
		this.backToThirdParty = page.getByRole('button', {
			name: 'Back to third-party app',
		});
	}

	/**
	 * Visit /sso-authorize with the given OAuth2 query parameters.
	 * Omitting `clientId` / `redirectUri` produces the invalid-request view.
	 */
	async goto(params: {
		clientId?: string;
		redirectUri?: string;
		scope?: string;
		state?: string;
	}): Promise<void> {
		const search = new URLSearchParams();
		if (params.clientId !== undefined) search.set('client_id', params.clientId);
		if (params.redirectUri !== undefined) {
			search.set('redirect_uri', params.redirectUri);
		}
		if (params.scope) search.set('scope', params.scope);
		if (params.state) search.set('state', params.state);
		const query = search.toString();
		await this.page.goto(query ? `/sso-authorize?${query}` : '/sso-authorize');
	}

	/** The consent checkbox row for a scope label. */
	scopeRow(label: string): Locator {
		return this.page
			.locator('[data-slot="checkbox"], label')
			.filter({ hasText: label })
			.first();
	}
}
