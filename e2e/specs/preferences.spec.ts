/**
 * @author Claude
 * @version 1.3
 * @date 2026/9/18 22:43:43
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
import type { Page } from '@playwright/test';

import { APP_ORIGIN, expect, test } from '../fixtures/index.ts';
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

test.describe('browser chrome tint', () => {
	// iOS Safari paints the strip above the page itself — a header's own
	// background cannot show through it — so `<meta name="theme-color">`
	// is the only lever the app has over that colour. Both palettes are
	// offered under `prefers-color-scheme`, and an explicit switcher
	// choice adds an unconditional entry that outranks them by being
	// FIRST in tree order: the user agent walks the candidates in tree
	// order and takes the first one whose media query matches, so an
	// override placed after the scoped entries would never win.
	//
	// The two values mirror THEME_COLOR in components/theme/config.ts,
	// i.e. HeroUI's `--surface` — the base colour of every header.
	const LIGHT = '#ffffff';
	const DARK = '#18181b';

	const mediaScoped = (page: Page, scheme: 'light' | 'dark') =>
		page.locator(
			`meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`
		);
	const unconditional = (page: Page) =>
		page.locator('meta[name="theme-color"]:not([media])');

	// True when the first `theme-color` in document order is the
	// unconditional override, i.e. the one the browser actually honours.
	const overrideComesFirst = (page: Page) =>
		page.evaluate(
			() =>
				document.head
					.querySelector('meta[name="theme-color"]')
					?.getAttribute('media') === null
		);

	test('offers one tint per palette when following the system', async ({
		anonPage,
	}) => {
		await anonPage.goto('/login');

		await expect(mediaScoped(anonPage, 'light')).toHaveAttribute(
			'content',
			LIGHT
		);
		await expect(mediaScoped(anonPage, 'dark')).toHaveAttribute(
			'content',
			DARK
		);
		// No explicit choice, so nothing outranks the media queries.
		await expect(unconditional(anonPage)).toHaveCount(0);
	});

	test('an explicit choice outranks the media-scoped entries', async ({
		authedPage,
	}) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await console_.switchTheme('Dark');
		await expect(unconditional(authedPage)).toHaveAttribute('content', DARK);
		// The client inserts the override dynamically — it must land ahead
		// of the scoped entries, not after them.
		expect(await overrideComesFirst(authedPage)).toBe(true);

		await console_.switchTheme('Light');
		await expect(unconditional(authedPage)).toHaveAttribute('content', LIGHT);
		expect(await overrideComesFirst(authedPage)).toBe(true);
	});

	test('an explicit choice is rendered on the server', async ({
		authedPage,
	}) => {
		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		await console_.switchTheme('Dark');

		// The reload re-renders from the theme cookie, so the tint must
		// not depend on the client having applied it after hydration.
		await authedPage.reload();
		await expect(unconditional(authedPage)).toHaveAttribute('content', DARK);
		expect(await overrideComesFirst(authedPage)).toBe(true);
	});

	test('following the system again drops the override', async ({
		authedPage,
	}) => {
		await authedPage.emulateMedia({ colorScheme: 'light' });

		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		await console_.switchTheme('Dark');
		await expect(unconditional(authedPage)).toHaveCount(1);

		await console_.switchTheme('Follow system');
		await expect(unconditional(authedPage)).toHaveCount(0);
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

test.describe('compact user menu', () => {
	test('marks the stored preference, not "follow …"', async ({
		authedPage,
	}) => {
		// The console header mounts the desktop switchers and the compact
		// user menu at the same time and hides one of them with CSS, so
		// both have to resolve the cookie independently.
		await authedPage.context().addCookies([
			{ name: 'NEXT_THEME', value: 'dark', url: APP_ORIGIN },
			{ name: 'NEXT_LOCALE', value: 'ja', url: APP_ORIGIN },
		]);
		await authedPage.setViewportSize({ width: 390, height: 844 });

		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		// Located by glyph rather than accessible name: the label is
		// translated, so a name lookup stops matching once the cookie
		// switches the page to Japanese.
		await authedPage
			.locator('[data-slot="dropdown-trigger"]:visible')
			.filter({ hasText: 'more_vert' })
			.first()
			.click();

		await expect(authedPage.locator('[data-key="theme-dark"]')).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await expect(authedPage.locator('[data-key="locale-ja"]')).toHaveAttribute(
			'aria-checked',
			'true'
		);
	});

	test('falls back to "follow …" when nothing is stored', async ({
		authedPage,
	}) => {
		await authedPage.setViewportSize({ width: 390, height: 844 });

		const console_ = new ConsolePage(authedPage);
		await console_.goto();

		await authedPage
			.locator('[data-slot="dropdown-trigger"]:visible')
			.filter({ hasText: 'more_vert' })
			.first()
			.click();

		await expect(authedPage.locator('[data-key="theme-auto"]')).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await expect(
			authedPage.locator('[data-key="locale-auto"]')
		).toHaveAttribute('aria-checked', 'true');
	});

	test('drops the mark again when following the system is restored', async ({
		authedPage,
	}) => {
		await authedPage.setViewportSize({ width: 390, height: 844 });

		const console_ = new ConsolePage(authedPage);
		await console_.goto();
		const menu = authedPage
			.locator('[data-slot="dropdown-trigger"]:visible')
			.filter({ hasText: 'more_vert' })
			.first();

		await menu.click();
		await authedPage.locator('[data-key="theme-dark"]').click();
		await authedPage.waitForTimeout(300);

		await menu.click();
		await expect(authedPage.locator('[data-key="theme-dark"]')).toHaveAttribute(
			'aria-checked',
			'true'
		);

		// Going back to "Follow system" must clear the picked theme rather
		// than leave the abandoned choice marked.
		await authedPage.locator('[data-key="theme-auto"]').click();
		await authedPage.waitForTimeout(300);

		await menu.click();
		await expect(authedPage.locator('[data-key="theme-auto"]')).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await expect(authedPage.locator('[data-key="theme-dark"]')).toHaveAttribute(
			'aria-checked',
			'false'
		);
	});
});
