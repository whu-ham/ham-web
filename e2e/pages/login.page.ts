/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:57:00
 *
 * Page object for the /login screen.
 *
 * The page renders QR (desktop) or "Open app" (mobile) plus a Passkey
 * button. Passkey is hidden when the browser reports no WebAuthn support,
 * so {@link passkeyButton} is exposed as a locator rather than assumed
 * present — specs that assert on it must check visibility first.
 *
 * /login uses the `sso` namespace for body copy and the `console.login`
 * namespace only for metadata, so all strings below come from `sso`.
 */
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
	readonly page: Page;
	readonly title: Locator;
	readonly qrCode: Locator;
	readonly qrRefresh: Locator;
	readonly scannedHint: Locator;
	readonly loginSuccess: Locator;
	readonly passkeyButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.title = page.getByRole('heading', { level: 1 });
		// The QR code is the only large SVG on the page; the rest are
		// 18px Material glyphs, so size is what distinguishes them.
		this.qrCode = page.locator('svg[height="144"]').first();
		// Rendered both when ticket creation fails and when the QR expires.
		// The accessible name comes from `sso.qr.refresh`, not `login.qr`.
		this.qrRefresh = page.getByRole('button', { name: 'Click to refresh' });
		this.scannedHint = page.getByText('Scanned, waiting for confirmation');
		this.loginSuccess = page.getByText('Signed in');
		this.passkeyButton = page.getByRole('button', {
			name: 'Sign in with passkey',
		});
	}

	/** Visit /login, optionally with a redirect-back target. */
	async goto(from?: string): Promise<void> {
		const url = from ? `/login?from=${encodeURIComponent(from)}` : '/login';
		await this.page.goto(url);
	}
}
