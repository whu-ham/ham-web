/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:59:00
 *
 * Token create / rotate / revoke flows on /console/tokens.
 *
 * Covers the happy paths plus the client-side validation and the backend
 * error branches (quota, server failure). Scope selection uses the
 * parent/child checkbox relationship, so both are exercised: picking a
 * child alone and picking the parent, which implies all children.
 */
import { expect, test } from '../fixtures/index.ts';
import { makeToken } from '../fixtures/data.ts';
import { readStub, setupStub } from '../stub/control.ts';
import { TokensPage, TokenRevealModal } from '../pages/index.ts';

test.describe('token create', () => {
	test('creates a token and reveals it once', async ({ authedPage }) => {
		await setupStub({ tokens: [] });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openCreate();
		await modal.create('Playwright Key', 'Full MCP access (read + write)');

		// The raw value is shown exactly once, in the reveal dialog.
		const reveal = new TokenRevealModal(authedPage);
		await reveal.waitFor();

		const revealed = await reveal.value();
		expect(revealed).toMatch(/^ham_[A-Za-z0-9]{40}$/);

		const state = await readStub();
		expect(state.tokens).toHaveLength(1);
		expect(state.tokens[0]?.name).toBe('Playwright Key');
		// The UI must show the same secret the backend issued.
		expect(revealed).toBe(state.lastCreatedRawToken);
		// Only the last four characters are ever persisted.
		expect(state.tokens[0]?.last4).toBe(revealed.slice(-4));
	});

	test('shows the new token in the list after closing the reveal', async ({
		authedPage,
	}) => {
		await setupStub({ tokens: [] });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openCreate();
		await modal.create('Listed Key', 'Full MCP access (read + write)');

		const reveal = new TokenRevealModal(authedPage);
		await reveal.waitFor();
		await reveal.close();

		await expect(authedPage.getByText('Listed Key')).toBeVisible();
		await expect(tokens.emptyTitle).toHaveCount(0);
	});

	test('rejects an empty name without calling the backend', async ({
		authedPage,
	}) => {
		await setupStub({ tokens: [] });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openCreate();
		await modal.nameInput.fill('   ');
		await modal.submitButton.click();

		await expect(authedPage.getByText('Name is required')).toBeVisible();
		const state = await readStub();
		expect(state.tokens).toHaveLength(0);
	});

	test('rejects submission when no scope is selected', async ({
		authedPage,
	}) => {
		await setupStub({ tokens: [] });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openCreate();
		await modal.nameInput.fill('No Scope Key');
		await modal.submitButton.click();

		await expect(
			authedPage.getByText('At least one scope is required')
		).toBeVisible();
		const state = await readStub();
		expect(state.tokens).toHaveLength(0);
	});

	test('selecting a child scope submits only that scope', async ({
		authedPage,
	}) => {
		await setupStub({ tokens: [] });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openCreate();
		await modal.nameInput.fill('Read Only Key');
		await modal.dialog.getByText('MCP read-only access').click();
		await modal.submitButton.click();

		const reveal = new TokenRevealModal(authedPage);
		await reveal.waitFor();

		const state = await readStub();
		expect(state.tokens[0]?.scopes).toEqual(['mcp:read']);
	});

	test('selecting the parent scope collapses to the parent only', async ({
		authedPage,
	}) => {
		await setupStub({ tokens: [] });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openCreate();
		await modal.nameInput.fill('Full Key');
		await modal.dialog.getByText('Full MCP access (read + write)').click();
		await modal.submitButton.click();

		const reveal = new TokenRevealModal(authedPage);
		await reveal.waitFor();

		const state = await readStub();
		expect(state.tokens[0]?.scopes).toEqual(['mcp']);
	});

	test('surfaces the quota error when the limit is reached', async ({
		authedPage,
	}) => {
		await setupStub({
			tokens: Array.from({ length: 5 }, (_, i) =>
				makeToken({ id: `tk_${i}`, name: `Key ${i}` })
			),
			tokenLimit: 5,
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openCreate();
		await modal.create('One Too Many', 'Full MCP access (read + write)');

		await expect(
			authedPage.getByText('Maximum token limit reached')
		).toBeVisible();
	});

	test('surfaces a generic error when creation fails', async ({
		authedPage,
	}) => {
		await setupStub({ tokens: [], tokenCreateFails: true });

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openCreate();
		await modal.create('Doomed Key', 'Full MCP access (read + write)');

		// The toast surfaces the backend's message when one is present,
		// falling back to the localised string only when it is absent.
		await expect(authedPage.getByText('create boom')).toBeVisible();
	});
});

test.describe('token rotate', () => {
	test('rotates a token and reveals the new value', async ({ authedPage }) => {
		await setupStub({
			tokens: [makeToken({ id: 'tk_1', name: 'Cursor IDE', last4: 'a1b2' })],
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openRotate('Cursor IDE');
		await expect(modal.dialog).toContainText(
			'The old key will be immediately revoked!'
		);
		await modal.confirm();

		const reveal = new TokenRevealModal(authedPage);
		await reveal.waitFor();

		const rotated = await reveal.value();
		expect(rotated).toMatch(/^ham_[A-Za-z0-9]{40}$/);

		const state = await readStub();
		// Rotation reissues the secret but keeps the row, and the card's
		// masked suffix must follow the new secret.
		expect(state.tokens).toHaveLength(1);
		expect(state.tokens[0]?.last4).toBe(rotated.slice(-4));
		expect(state.tokens[0]?.last4).not.toBe('a1b2');
	});

	test('surfaces an error when rotation fails', async ({ authedPage }) => {
		await setupStub({
			tokens: [makeToken({ id: 'tk_1', name: 'Cursor IDE' })],
			tokenRotateFails: true,
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		const modal = await tokens.openRotate('Cursor IDE');
		await modal.confirm();

		await expect(authedPage.getByText('rotate boom')).toBeVisible();
	});
});

test.describe('token revoke', () => {
	test('revokes a token after confirmation', async ({ authedPage }) => {
		await setupStub({
			tokens: [
				makeToken({ id: 'tk_1', name: 'Cursor IDE' }),
				makeToken({ id: 'tk_2', name: 'Keep Me', last4: 'zz99' }),
			],
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await tokens.revoke('Cursor IDE');

		await expect(authedPage.getByText('Cursor IDE')).toHaveCount(0);
		await expect(authedPage.getByText('Keep Me')).toBeVisible();

		const state = await readStub();
		expect(state.tokens.map((t) => t.name)).toEqual(['Keep Me']);
	});

	test('keeps the token when the confirmation is cancelled', async ({
		authedPage,
	}) => {
		await setupStub({
			tokens: [makeToken({ id: 'tk_1', name: 'Cursor IDE' })],
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await tokens.cancelRevoke('Cursor IDE');

		await expect(authedPage.getByText('Cursor IDE')).toBeVisible();
		const state = await readStub();
		expect(state.tokens).toHaveLength(1);
	});

	test('leaves the last token revocable and shows the empty state', async ({
		authedPage,
	}) => {
		await setupStub({
			tokens: [makeToken({ id: 'tk_1', name: 'Sole Key' })],
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await tokens.revoke('Sole Key');

		await expect(tokens.emptyTitle).toBeVisible();
	});

	test('surfaces an error when revocation fails', async ({ authedPage }) => {
		await setupStub({
			tokens: [makeToken({ id: 'tk_1', name: 'Cursor IDE' })],
			tokenRevokeFails: true,
		});

		const tokens = new TokensPage(authedPage);
		await tokens.goto();

		await tokens.revoke('Cursor IDE');

		// Revoke surfaces the localised string, not the backend message.
		await expect(authedPage.getByText('Failed to revoke')).toBeVisible();
		// The row must survive a failed revoke.
		await expect(authedPage.getByText('Cursor IDE')).toBeVisible();
	});
});
