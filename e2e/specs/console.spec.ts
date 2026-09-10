/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 13:00:00
 *
 * Console home at /console and the shared header controls.
 *
 * Covers the greeting, navigation into the token screen and back, and the
 * logout path. Theme and language switching are asserted through their
 * persisted cookies, since that is what makes the choice survive a
 * reload — the visible glyph is only a reflection of it.
 */
import { expect, test } from '../fixtures/index.ts';
import { setupStub } from '../stub/control.ts';
import { ConsolePage, TokensPage } from '../pages/index.ts';

test.describe('console home', () => {
	test('greets the signed-in user by nickname', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		// The greeting is time-of-day dependent, so assert on the name.
		await expect(console_.greeting).toContainText('E2E User');
	});

	test('falls back to the user id when the nickname is absent', async ({
		authedPage,
	}) => {
		await setupStub({
			me: { user_id: 'u_nonick', nickname: undefined, avatar_url: null },
		});

		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await expect(console_.greeting).toContainText('u_nonick');
	});

	test('falls back to the user id when the nickname is a blank string', async ({
		authedPage,
	}) => {
		// A blank nickname must not render an empty name. `??` alone
		// would not catch '' — see displayName in services/sso/api.
		await setupStub({
			me: { user_id: 'u_nonick', nickname: '', avatar_url: null },
		});

		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await expect(console_.greeting).toContainText('u_nonick');
	});

	test('falls back to the user id when the nickname is whitespace only', async ({
		authedPage,
	}) => {
		await setupStub({
			me: { user_id: 'u_nonick', nickname: '   ', avatar_url: null },
		});

		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await expect(console_.greeting).toContainText('u_nonick');
	});

	test('navigates to the token screen and back', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.openApiKeys();
		await expect(authedPage).toHaveURL(/\/console\/tokens/);

		const tokens = new TokensPage(authedPage);
		await authedPage
			.getByRole('heading', { name: 'API Keys', level: 1 })
			.waitFor({ state: 'visible' });

		await tokens.backToConsole();
		await expect(authedPage).toHaveURL(/\/console$/);
	});
});

test.describe('console header', () => {
	test('switching the theme persists it in a cookie', async ({
		authedPage,
	}) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.switchTheme('Dark');

		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'dark'
		);

		const cookies = await authedPage.context().cookies();
		expect(cookies.find((c) => c.name === 'NEXT_THEME')?.value).toBe('dark');
	});

	test('switching back to light updates the theme attribute', async ({
		authedPage,
	}) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.switchTheme('Dark');
		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'dark'
		);

		await console_.switchTheme('Light');
		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'light'
		);
	});

	test('switching the language persists it and re-renders', async ({
		authedPage,
	}) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.switchLanguage('日本語');

		// The localised feature card proves the catalogue swap took effect.
		await expect(authedPage.getByText('API Key 管理')).toBeVisible();

		const cookies = await authedPage.context().cookies();
		expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('ja');
	});

	test('logging out ends the session', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.logout();

		// useLogout pushes '/' and lets the server re-decide where to land.
		// The stub clears the session on logout, so we end up back at /login.
		await expect(authedPage).toHaveURL(/\/login/);
	});
});
