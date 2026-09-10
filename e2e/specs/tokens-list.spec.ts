/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:58:00
 *
 * Token list rendering on /console/tokens.
 *
 * Covers the states the list can be in: populated (including SSR
 * preloading, so the first paint already has rows), empty, and failed
 * fetch. The failed-fetch case additionally asserts the retry affordance
 * recovers the list once the backend comes back.
 */
import { expect, test } from '../fixtures/index.ts';
import { makeToken } from '../fixtures/data.ts';
import { patchStub, setupStub } from '../stub/control.ts';
import { TokensPage } from '../pages/index.ts';

test.describe('token list', () => {
	test('renders tokens preloaded by SSR', async ({ authedPage }) => {
		await setupStub({
			tokens: [
				makeToken({ id: 'tk_1', name: 'Cursor IDE', last4: 'a1b2' }),
				makeToken({
					id: 'tk_2',
					name: 'CI/CD Pipeline',
					last4: 'c3d4',
					scopes: ['mcp:read', 'mcp:write'],
				}),
			],
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await expect(authedPage.getByText('Cursor IDE')).toBeVisible();
		await expect(authedPage.getByText('CI/CD Pipeline')).toBeVisible();

		// last4 is masked, never the raw value.
		await expect(authedPage.getByText('****a1b2')).toBeVisible();
		await expect(authedPage.getByText('****c3d4')).toBeVisible();
	});

	test('shows every scope a token carries', async ({ authedPage }) => {
		await setupStub({
			tokens: [
				makeToken({
					name: 'Multi Scope',
					scopes: ['mcp:read', 'mcp:write'],
				}),
			],
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const card = tokens.card('Multi Scope');
		await expect(card.getByText('mcp:read')).toBeVisible();
		await expect(card.getByText('mcp:write')).toBeVisible();
	});

	test('shows the empty state when there are no tokens', async ({
		authedPage,
	}) => {
		await setupStub({ tokens: [] });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await expect(tokens.emptyTitle).toBeVisible();
		await expect(tokens.createButton).toBeVisible();
	});

	test('shows a never-used token without a last-used date', async ({
		authedPage,
	}) => {
		await setupStub({ tokens: [makeToken({ last_used_at: null })] });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await expect(authedPage.getByText('Never used')).toBeVisible();
	});

	test('shows a last-used date when the backend reports one', async ({
		authedPage,
	}) => {
		await setupStub({
			tokens: [makeToken({ last_used_at: '2026-09-01T00:00:00.000Z' })],
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await expect(authedPage.getByText(/Last used/)).toBeVisible();
		await expect(authedPage.getByText('Never used')).toHaveCount(0);
	});

	test('shows the empty state with a retry button when the fetch fails', async ({
		authedPage,
	}) => {
		await setupStub({ tokenListFails: true });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await expect(tokens.emptyTitle).toBeVisible();
		await expect(tokens.retryButton).toBeVisible();
	});

	test('recovers the list when retry succeeds', async ({ authedPage }) => {
		await setupStub({
			tokenListFails: true,
			tokens: [makeToken({ name: 'Recovered Key' })],
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();
		await expect(tokens.retryButton).toBeVisible();

		// Heal the backend without resetting, so the seeded token survives.
		await patchStub({ tokenListFails: false });
		await tokens.retryButton.click();

		await expect(authedPage.getByText('Recovered Key')).toBeVisible();
	});
});
