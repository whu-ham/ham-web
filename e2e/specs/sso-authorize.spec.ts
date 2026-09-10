/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 13:04:00
 *
 * The /sso-authorize screen.
 *
 * This page branches four ways, so the suite is organised by outcome:
 * invalid request, desktop + anonymous (redirect to login), desktop +
 * authenticated (consent), and mobile (deep-link handoff then fallback).
 * The mobile cases run only on the iPhone project, since the branch is
 * decided from the User-Agent.
 */
import { expect, test } from '../fixtures/index.ts';
import { setupStub } from '../stub/control.ts';
import { SsoAuthorizePage } from '../pages/index.ts';
import { CONSENT_SCOPES, REDIRECT_URI } from '../fixtures/data.ts';

test.describe('sso authorize — invalid request', () => {
	test('rejects a request with no parameters', async ({ anonPage }) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({});

		await expect(sso.invalidTitle).toBeVisible();
		await expect(
			anonPage.getByText('Required authorization parameters are missing')
		).toBeVisible();
	});

	test('rejects a request missing the redirect uri', async ({ anonPage }) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({ clientId: 'stub-app' });

		await expect(sso.invalidTitle).toBeVisible();
	});

	test('rejects a request missing the client id', async ({ anonPage }) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({ redirectUri: REDIRECT_URI });

		await expect(sso.invalidTitle).toBeVisible();
	});

	test('rejects a blank client id', async ({ anonPage }) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({ clientId: '   ', redirectUri: REDIRECT_URI });

		await expect(sso.invalidTitle).toBeVisible();
	});
});

test.describe('sso authorize — desktop', () => {
	test('sends an anonymous visitor to /login and preserves the target', async ({
		anonPage,
	}) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
			state: 'xyz',
		});

		await expect(anonPage).toHaveURL(/\/login\?from=%2Fsso-authorize/);
	});

	test('renders the consent screen for an authenticated user', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
			state: 'xyz',
		});

		await expect(sso.appName).toBeVisible();
		await expect(
			authedPage.getByText('The app will receive the following permissions:')
		).toBeVisible();
		await expect(sso.authorizeButton).toBeVisible();
		await expect(sso.rejectButton).toBeVisible();
	});

	test('lists the requested scopes with their groups', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
		});

		// Exact matching: "Identity" also appears inside the group title.
		await expect(
			authedPage.getByText('Identity', { exact: true })
		).toBeVisible();
		await expect(authedPage.getByText('MCP', { exact: true })).toBeVisible();
		await expect(
			authedPage.getByText('Identity and profile permissions')
		).toBeVisible();
		await expect(
			authedPage.getByText('Tool and API permissions')
		).toBeVisible();
	});

	test('marks a required scope as required and pre-checks it', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
		});

		const requiredRow = sso.scopeRow('Identity');
		await expect(requiredRow).toContainText('Required');
		// Required scopes cannot be unchecked.
		await expect(requiredRow.locator('input')).toBeDisabled();
	});

	test('shows a previously granted scope as already granted', async ({
		authedPage,
	}) => {
		await setupStub({
			consentScopes: [
				{
					...CONSENT_SCOPES[0]!,
					scope: 'mcp',
					label: 'MCP',
					category: 'mcp',
					already_granted: true,
					required: false,
				},
			],
		});

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'mcp',
		});

		await expect(sso.scopeRow('MCP')).toContainText('Previously granted');
	});

	test('shows the previously-authorized banner when auto-approval applies', async ({
		authedPage,
	}) => {
		await setupStub({ canAutoAuthorize: true });

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.previouslyAuthorized).toBeVisible();
	});

	test('identifies the signed-in user and offers a switch', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(authedPage.getByText('E2E User')).toBeVisible();
		await expect(sso.switchAccount).toBeVisible();
	});

	test('authorizing redirects to the client with a code and state', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
			state: 'xyz',
		});

		await expect(sso.authorizeButton).toBeVisible();
		await sso.authorizeButton.click();

		await authedPage.waitForURL(/example\.com\/callback/, {
			timeout: 10_000,
		});
		const url = new URL(authedPage.url());
		expect(url.searchParams.get('code')).toBe('stub-auth-code');
		expect(url.searchParams.get('state')).toBe('xyz');
	});

	test('rejecting redirects to the client with access_denied', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
			state: 'xyz',
		});

		await expect(sso.rejectButton).toBeVisible();
		await sso.rejectButton.click();

		await authedPage.waitForURL(/example\.com\/callback/, {
			timeout: 10_000,
		});
		const url = new URL(authedPage.url());
		expect(url.searchParams.get('error')).toBe('access_denied');
		expect(url.searchParams.get('state')).toBe('xyz');
	});

	test('switching account signs out and returns to /login', async ({
		authedPage,
	}) => {
		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.switchAccount).toBeVisible();
		await sso.switchAccount.click();

		await expect(authedPage).toHaveURL(/\/login\?from=%2Fsso-authorize/, {
			timeout: 10_000,
		});
	});

	test('shows an error view when consent details cannot be loaded', async ({
		authedPage,
	}) => {
		await setupStub({ consentInfoFails: true });

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.errorTitle).toBeVisible();
		await expect(sso.backToThirdParty).toBeVisible();
	});

	test('returns to the third-party app when consent confirmation fails', async ({
		authedPage,
	}) => {
		await setupStub({ consentConfirmFails: true });

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
			state: 'xyz',
		});

		await expect(sso.authorizeButton).toBeVisible();
		await sso.authorizeButton.click();

		// On failure the hook bails with server_error back to the client.
		await authedPage.waitForURL(/example\.com\/callback/, {
			timeout: 10_000,
		});
		const url = new URL(authedPage.url());
		expect(url.searchParams.get('error')).toBe('server_error');
	});
});
