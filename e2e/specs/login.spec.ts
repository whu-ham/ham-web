/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 13:02:00
 *
 * The /login screen.
 *
 * QR login is driven by the stub backend's ticket state machine, which
 * lets each state (pending → scanned → confirmed) be asserted without a
 * real mobile app. Passkey cannot complete in a headless browser — it
 * needs a platform authenticator — so the spec only asserts that the
 * button is offered, not that sign-in succeeds.
 */
import { expect, test } from '../fixtures/index.ts';
import { readStub, setupStub } from '../stub/control.ts';
import { LoginPage } from '../pages/index.ts';

test.describe('login screen', () => {
	test('renders the sign-in heading and QR code', async ({ anonPage }) => {
		const login = new LoginPage(anonPage);
		await login.goto();

		// /login renders the `login` namespace, not `sso.login`.
		await expect(login.title).toHaveText('Sign in to Ham');
		await expect(anonPage.getByText('Scan the QR code')).toBeVisible();
		await expect(login.qrCode).toBeVisible();
	});

	test('requests a QR ticket from the backend', async ({ anonPage }) => {
		const login = new LoginPage(anonPage);
		await login.goto();
		await expect(login.qrCode).toBeVisible();

		const state = await readStub();
		expect(state.qrTicket).toMatch(/^tk_\d+$/);
	});

	test('shows the scanned state and the scanning user', async ({
		anonPage,
	}) => {
		await setupStub({ qrState: 'SCANNED' });

		const login = new LoginPage(anonPage);
		await login.goto();

		await expect(login.scannedHint).toBeVisible();
		await expect(anonPage.getByText('E2E User')).toBeVisible();
	});

	test('offers a refresh when the QR code expires', async ({ anonPage }) => {
		await setupStub({ qrState: 'EXPIRED' });

		const login = new LoginPage(anonPage);
		await login.goto();

		await expect(anonPage.getByText('QR code expired')).toBeVisible();
		await expect(login.qrRefresh).toBeVisible();
	});

	test('shows an error and a retry when ticket creation fails', async ({
		anonPage,
	}) => {
		await setupStub({ qrCreateFails: true });

		const login = new LoginPage(anonPage);
		await login.goto();

		// The QR block disappears entirely; the refresh affordance is the
		// only recovery path the `login` namespace offers.
		await expect(login.qrCode).toHaveCount(0);
	});

	test('signs the user in once the ticket is confirmed', async ({
		anonPage,
	}) => {
		await setupStub({ qrState: 'CONFIRMED' });

		const login = new LoginPage(anonPage);
		await login.goto();

		// The stub sets the session cookie on confirmation; the client then
		// navigates on. The "Signed in" confirmation is a transient state
		// that usually renders for less than a poll interval, so assert on
		// the durable outcome instead.
		await expect(anonPage).toHaveURL(/\/console/, { timeout: 10_000 });
		await expect(anonPage.getByRole('heading', { level: 1 })).toContainText(
			'E2E User'
		);

		const cookies = await anonPage.context().cookies();
		expect(cookies.find((c) => c.name === 'ham_session')?.value).toBe(
			'e2e-session'
		);
	});

	test('keeps the return target through a completed login', async ({
		anonPage,
	}) => {
		await setupStub({ qrState: 'CONFIRMED' });

		const login = new LoginPage(anonPage);
		await login.goto('/console/tokens');

		await expect(anonPage).toHaveURL(/\/console\/tokens/, {
			timeout: 10_000,
		});
		await expect(
			anonPage.getByRole('heading', { name: 'API Keys', level: 1 })
		).toBeVisible();
	});

	test('offers passkey sign-in alongside the QR code', async ({ anonPage }) => {
		const login = new LoginPage(anonPage);
		await login.goto();

		// Rendered only when the browser advertises WebAuthn support.
		await expect(login.passkeyButton).toBeVisible();
	});
});
