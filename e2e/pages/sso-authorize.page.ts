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

	/**
	 * Visit /sso-authorize and wait for a redirect to land.
	 *
	 * The page redirects from the server for anonymous desktop visitors,
	 * so the URL is only meaningful once that navigation has settled.
	 */
	async gotoAndWaitFor(
		params: {
			clientId?: string;
			redirectUri?: string;
			scope?: string;
			state?: string;
		},
		urlPattern: RegExp
	): Promise<void> {
		await this.goto(params);
		await this.page.waitForURL(urlPattern, { timeout: 10_000 });
	}

	/**
	 * The consent checkbox for a scope value.
	 *
	 * Matched on the input's `value` rather than its visible text: scope
	 * labels are short and overlap with the group headings they sit under
	 * (e.g. "MCP" appears in both the checkbox and its group title).
	 */
	scopeCheckbox(scope: string): Locator {
		return this.page.locator(`[data-slot="checkbox"] input[value="${scope}"]`);
	}

	/**
	 * Toggle a consent scope.
	 *
	 * HeroUI renders the visible control as an overlay on top of the
	 * native input, so clicking the input directly is blocked. The
	 * surrounding row is what a user actually hits.
	 */
	async toggleScope(scope: string): Promise<void> {
		// Click the visible label rather than the container's centre: the
		// centre can be covered by a sibling node, and Playwright refuses
		// to click through — which failed intermittently on slower runners.
		await this.page
			.locator(`[data-slot="checkbox"]:has(input[value="${scope}"])`)
			.locator('[data-slot="checkbox-content"]')
			.click();
	}

	/** The consent checkbox row for a scope label. */
	scopeRow(label: string): Locator {
		return this.page
			.locator('[data-slot="checkbox"], label')
			.filter({ hasText: label })
			.first();
	}
}
