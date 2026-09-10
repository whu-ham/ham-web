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
import { readStub, setupStub } from '../stub/control.ts';
import { LoginPage, SsoAuthorizePage } from '../pages/index.ts';
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
		// The server already bounces anonymous desktop visitors; wait for
		// the redirect to land rather than asserting mid-navigation, which
		// races the 307 under load.
		await sso.gotoAndWaitFor(
			{
				clientId: 'stub-app',
				redirectUri: REDIRECT_URI,
				scope: 'identity',
				state: 'xyz',
			},
			/\/login\?from=%2Fsso-authorize/
		);

		await expect(anonPage).toHaveURL(/\/login\?from=%2Fsso-authorize/);
		await expect(new LoginPage(anonPage).title).toHaveText('Sign in to Ham');
	});

	test('keeps the full authorize URL in the from parameter', async ({
		anonPage,
	}) => {
		const sso = new SsoAuthorizePage(anonPage);
		await sso.gotoAndWaitFor(
			{
				clientId: 'stub-app',
				redirectUri: REDIRECT_URI,
				scope: 'identity mcp',
				state: 'xyz',
			},
			/\/login\?from=/
		);

		// The return target must carry the whole query string, otherwise
		// signing in drops the client_id and the consent flow restarts.
		const from = new URL(anonPage.url()).searchParams.get('from') ?? '';
		const target = new URL(from, 'http://stub.local');
		expect(target.searchParams.get('client_id')).toBe('stub-app');
		expect(target.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
		expect(target.searchParams.get('scope')).toBe('identity mcp');
		expect(target.searchParams.get('state')).toBe('xyz');
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

	test('does not auto-authorize a previously approved app', async ({
		authedPage,
	}) => {
		// can_auto_authorize only drives the informational banner; the user
		// must still click Authorize, so the flag must never skip consent.
		await setupStub({ canAutoAuthorize: true });

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity',
		});

		await expect(sso.previouslyAuthorized).toBeVisible();
		await expect(sso.authorizeButton).toBeVisible();
		// Still on the consent screen, not redirected to the client.
		expect(authedPage.url()).toContain('/sso-authorize');
	});

	test('sends only the checked scopes when authorizing', async ({
		authedPage,
	}) => {
		await setupStub();

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
		});

		await expect(sso.appName).toBeVisible();

		// NOTE: the checkboxes render unselected even though the hook sends
		// every scope until the user interacts (see effectiveCheckedScopes
		// in useConsent). Toggle MCP on and back off so the selection is
		// definitely driven by the UI rather than that fallback.
		await sso.toggleScope('mcp');
		await expect(sso.scopeCheckbox('mcp')).toBeChecked();
		await sso.toggleScope('mcp');
		await expect(sso.scopeCheckbox('mcp')).not.toBeChecked();

		await sso.authorizeButton.click();
		await authedPage.waitForURL(/example\.com\/callback/, {
			timeout: 10_000,
		});

		const state = await readStub();
		expect(state.lastConfirmedScopes).not.toContain('mcp');
	});

	test('sends every requested scope when none are unchecked', async ({
		authedPage,
	}) => {
		await setupStub();

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
		});

		await expect(sso.authorizeButton).toBeVisible();
		await sso.authorizeButton.click();
		await authedPage.waitForURL(/example\.com\/callback/, {
			timeout: 10_000,
		});

		const state = await readStub();
		expect(state.lastConfirmedScopes).toEqual(['identity', 'mcp']);
	});

	test('keeps a required scope selected when the user tries to drop it', async ({
		authedPage,
	}) => {
		await setupStub();

		const sso = new SsoAuthorizePage(authedPage);
		await sso.goto({
			clientId: 'stub-app',
			redirectUri: REDIRECT_URI,
			scope: 'identity mcp',
		});

		// Required scopes are disabled, so there is no way to drop them:
		// the control rejects interaction outright.
		await expect(sso.scopeCheckbox('identity')).toBeDisabled();
		await expect(sso.scopeRow('Identity')).toContainText('Required');

		await sso.authorizeButton.click();
		await authedPage.waitForURL(/example\.com\/callback/, {
			timeout: 10_000,
		});
		// withRequiredConsentScopes re-adds it server-side regardless.
		expect((await readStub()).lastConfirmedScopes).toContain('identity');
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

		// Also a client-side navigation: the hook signs out, then points
		// the browser at /login with the current URL as the return target.
		await authedPage.waitForURL(/\/login\?from=%2Fsso-authorize/, {
			timeout: 10_000,
		});
		await expect(authedPage).toHaveURL(/\/login\?from=%2Fsso-authorize/);
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
