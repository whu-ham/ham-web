/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 16:35:00
 *
 * Theme and language preferences.
 *
 * Both follow the same design: a concrete choice is persisted (theme in
 * the NEXT_THEME cookie plus localStorage, language in NEXT_LOCALE) and
 * the absence of a choice means "follow the environment" — the OS colour
 * scheme for theme, the browser's Accept-Language for locale.
 *
 * The specs therefore check two things each: that an explicit choice
 * survives a reload, and that "auto" resolves from the environment. Both
 * matter because the server renders the first paint from the cookie, so
 * a preference that only lives in client state would flash the wrong
 * value on every navigation.
 */
import { expect, test } from '../fixtures/index.ts';
import { ConsolePage, LoginPage } from '../pages/index.ts';

test.describe('theme preference', () => {
	test('defaults to light when the system prefers light', async ({
		authedPage,
	}) => {
		await authedPage.emulateMedia({ colorScheme: 'light' });

		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		// No cookie means "follow system".
		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'light'
		);
	});

	test('follows the system when set to dark', async ({ authedPage }) => {
		await authedPage.emulateMedia({ colorScheme: 'dark' });

		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'dark'
		);
	});

	test('an explicit dark choice survives a reload', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		await console_.switchTheme('Dark');
		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'dark'
		);

		await authedPage.reload();

		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'dark'
		);
	});

	test('an explicit choice overrides the system preference', async ({
		authedPage,
	}) => {
		await authedPage.emulateMedia({ colorScheme: 'dark' });

		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		// System says dark, user says light: the explicit choice wins.
		await console_.switchTheme('Light');

		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'light'
		);

		await authedPage.reload();
		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'light'
		);
	});

	test('the choice carries across pages', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		await console_.switchTheme('Dark');

		await authedPage.goto('/console/tokens');

		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'dark'
		);
	});

	test('following system again drops the stored override', async ({
		authedPage,
	}) => {
		await authedPage.emulateMedia({ colorScheme: 'light' });

		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		await console_.switchTheme('Dark');
		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'dark'
		);

		await console_.switchTheme('Follow system');

		// Back to the system preference, which this context sets to light.
		await expect(authedPage.locator('html')).toHaveAttribute(
			'data-theme',
			'light'
		);
	});
});

test.describe('language preference', () => {
	test('falls back to a supported browser language', async ({ authedPage }) => {
		// The suite's default context is en-US.
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await expect(authedPage.locator('html')).toHaveAttribute('lang', 'en');
		await expect(authedPage.getByText('API Key Management')).toBeVisible();
	});

	test('switching to Japanese re-renders the page', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.switchLanguage('日本語');

		await expect(authedPage.getByText('API Key 管理')).toBeVisible();
		await expect(authedPage.getByText('API Key Management')).toHaveCount(0);
	});

	test('switching to Chinese re-renders the page', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.switchLanguage('简体中文');

		await expect(authedPage.getByText('API Key 管理')).toBeVisible();
	});

	test('the chosen language survives a reload', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		await console_.switchLanguage('日本語');

		await authedPage.reload();

		await expect(authedPage.getByText('API Key 管理')).toBeVisible();
		await expect(authedPage.locator('html')).toHaveAttribute('lang', 'ja');
	});

	test('the chosen language carries across pages', async ({ authedPage }) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		await console_.switchLanguage('日本語');

		await authedPage.goto('/console/tokens');

		// The page title is server-rendered, so proving it switched also
		// proves SSR picked up the cookie. Note the tokens heading itself
		// is "API Keys" in every catalogue — it is an untranslated loanword.
		await expect(authedPage).toHaveTitle(/API Key 管理/);
	});

	test('switching back to English restores the English catalogue', async ({
		authedPage,
	}) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.switchLanguage('日本語');
		await expect(authedPage.getByText('API Key 管理')).toBeVisible();

		await console_.switchLanguage('English');

		await expect(authedPage.getByText('API Key Management')).toBeVisible();
		await expect(authedPage.locator('html')).toHaveAttribute('lang', 'en');
	});

	test('a language choice applies to the login screen too', async ({
		anonPage,
	}) => {
		await anonPage.goto('/login');

		// The theme and language switchers sit in the login header as well.
		await anonPage.getByRole('button', { name: 'Change language' }).click();
		await anonPage.getByRole('menuitemradio', { name: '日本語' }).click();

		await expect(new LoginPage(anonPage).title).toHaveText('Hamにログイン');
	});
});
