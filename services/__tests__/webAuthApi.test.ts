/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the BFF auth API surface (`WebAuthApi`).
 *
 * Each method is asserted through the `fetch` boundary rather than by
 * mocking `request`: the path, method and body are the contract with the
 * BFF proxy routes, and a typo in any of them only shows up at runtime.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError as SharedApiError, API_BASE } from '@/services/shared';
import { ApiError, QR_TICKET_STATE, WebAuthApi } from '@/services/sso/api';

type FetchInit = RequestInit & { headers: Record<string, string> };

const stubFetch = (body: unknown, status = 200) => {
	const fetchMock = vi.fn(
		async () =>
			new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' },
			})
	);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
};

const lastCall = (fetchMock: ReturnType<typeof stubFetch>) => {
	expect(fetchMock).toHaveBeenCalledTimes(1);
	return fetchMock.mock.calls[0] as unknown as [string, FetchInit];
};

describe('WebAuthApi', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('QR login', () => {
		it('creates a ticket', async () => {
			const fetchMock = stubFetch({
				code: '0',
				message: 'ok',
				data: { ticket: 't_1', expires_in: 120 },
			});

			await expect(WebAuthApi.createQrTicket()).resolves.toEqual({
				ticket: 't_1',
				expires_in: 120,
			});

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/auth/qr/ticket`);
			expect(init.method).toBe('POST');
			expect(init.body).toBeUndefined();
		});

		it('checks a ticket without a body', async () => {
			const fetchMock = stubFetch({
				code: '0',
				message: 'ok',
				data: { state: 'PENDING' },
			});

			await expect(WebAuthApi.checkQrTicket('t_1')).resolves.toEqual({
				state: 'PENDING',
			});

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/auth/qr/ticket/t_1`);
			expect(init.method).toBeUndefined();
		});

		// The ticket travels in the path, so a ticket containing `/` or `?`
		// would otherwise change which endpoint is hit.
		it('URL-encodes the ticket it checks', async () => {
			const fetchMock = stubFetch({ code: '0', message: 'ok', data: {} });

			await WebAuthApi.checkQrTicket('t/1 ?2');

			expect(lastCall(fetchMock)[0]).toBe(
				`${API_BASE}/auth/qr/ticket/t%2F1%20%3F2`
			);
		});
	});

	describe('passkey', () => {
		it('requests a challenge', async () => {
			const fetchMock = stubFetch({
				code: '0',
				message: 'ok',
				data: { session: 's_1', json: '{}' },
			});

			await expect(WebAuthApi.getPasskeyOption()).resolves.toEqual({
				session: 's_1',
				json: '{}',
			});

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/auth/passkey/option`);
			expect(init.method).toBe('POST');
		});

		it('posts the assertion together with the session', async () => {
			const fetchMock = stubFetch({
				code: '0',
				message: 'ok',
				data: { user_id: 'u_1' },
			});

			await WebAuthApi.passkeyLogin('{"id":"cred"}', 'sess-1');

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/auth/passkey/login`);
			expect(init.method).toBe('POST');
			// The field names are the backend contract: `assertion_json`
			// carries the serialized credential, `session` the challenge id.
			expect(init.body).toBe(
				JSON.stringify({ assertion_json: '{"id":"cred"}', session: 'sess-1' })
			);
			expect(init.headers['Content-Type']).toBe('application/json');
		});
	});

	describe('session', () => {
		it('reads the current user', async () => {
			const fetchMock = stubFetch({
				code: '0',
				message: 'ok',
				data: { user_id: 'u_1', nickname: 'Ada' },
			});

			await expect(WebAuthApi.me()).resolves.toEqual({
				user_id: 'u_1',
				nickname: 'Ada',
			});

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/auth/me`);
			expect(init.method).toBeUndefined();
		});

		it('logs out', async () => {
			const fetchMock = stubFetch({ code: '0', message: 'ok', data: null });

			await WebAuthApi.logout();

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/auth/logout`);
			expect(init.method).toBe('POST');
		});

		it('refreshes the session', async () => {
			const fetchMock = stubFetch({ code: '0', message: 'ok', data: null });

			await WebAuthApi.refresh();

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/auth/refresh`);
			expect(init.method).toBe('POST');
		});
	});

	describe('consent', () => {
		it('posts the authorize request to the consent info endpoint', async () => {
			const fetchMock = stubFetch({
				code: '0',
				message: 'ok',
				data: { app: { client_id: 'app', name: 'App' }, scopes: [] },
			});
			const payload = {
				client_id: 'app',
				scope: ['openid', 'profile'],
				redirect_uri: 'https://app.example.com/cb',
				state: 'st',
				code_challenge: 'chal',
				code_challenge_method: 'S256',
				nonce: 'n',
			};

			await WebAuthApi.consentInfo(payload);

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/sso/consent/info`);
			expect(init.method).toBe('POST');
			expect(init.body).toBe(JSON.stringify(payload));
		});

		it('posts the confirmed scope selection', async () => {
			const fetchMock = stubFetch({
				code: '0',
				message: 'ok',
				data: { redirect_url: 'https://app.example.com/cb?code=c' },
			});
			const payload = {
				client_id: 'app',
				scope: ['openid'],
				redirect_uri: 'https://app.example.com/cb',
				state: 'st',
				nonce: 'n',
			};

			await expect(WebAuthApi.consentConfirm(payload)).resolves.toEqual({
				redirect_url: 'https://app.example.com/cb?code=c',
			});

			const [url, init] = lastCall(fetchMock);
			expect(url).toBe(`${API_BASE}/sso/consent/confirm`);
			expect(init.method).toBe('POST');
			expect(init.body).toBe(JSON.stringify(payload));
		});
	});

	it('surfaces a backend error as an ApiError', async () => {
		stubFetch({ code: '11001', message: 'not signed in' }, 401);

		const error = await WebAuthApi.me().catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(401);
		expect((error as ApiError).code).toBe('11001');
	});
});

describe('module surface', () => {
	it('re-exports the shared ApiError', () => {
		expect(ApiError).toBe(SharedApiError);
	});

	it('exposes the QR ticket state machine', () => {
		expect(QR_TICKET_STATE).toEqual({
			PENDING: 'PENDING',
			SCANNED: 'SCANNED',
			CONFIRMED: 'CONFIRMED',
			EXPIRED: 'EXPIRED',
			INVALID: 'INVALID',
		});
	});
});
