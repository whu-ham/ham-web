/**
 * MSW request handlers for token and auth API endpoints.
 * Intercepts /api/tokens/** and /api/auth/** requests and returns mock data.
 */
import { delay, http, HttpResponse } from 'msw';

import { mockMe, mockTokenList } from '@/mocks/data';

// ---------------------------------------------------------------------------
// Mutable mock data store (client-side only)
// ---------------------------------------------------------------------------

let nextId = 4;

const now = Date.now();
const dayMs = 86_400_000;

const futureDate = (days: number) => new Date(now + days * dayMs).toISOString();

// Deep clone shared data so mutations don't affect the SSR module
const mockTokens = structuredClone(mockTokenList);

const generateTokenValue = (): string => {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = 'ham_';
	for (let i = 0; i < 40; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Auth handlers
// ---------------------------------------------------------------------------

export const authHandlers = [
	// GET /api/auth/me — return mock logged-in user
	http.get('*/api/auth/me', async () => {
		await delay(200);
		return HttpResponse.json(envelope(mockMe));
	}),

	// POST /api/auth/logout — no-op
	http.post('*/api/auth/logout', async () => {
		await delay(100);
		return new HttpResponse(null, { status: 204 });
	}),

	// POST /api/auth/refresh — no-op
	http.post('*/api/auth/refresh', async () => {
		await delay(100);
		return new HttpResponse(null, { status: 204 });
	}),
];

// ---------------------------------------------------------------------------
// Token handlers
// ---------------------------------------------------------------------------

/** Wrap mock data in the standard backend envelope { code, message, data }. */
const envelope = <T>(data: T) => ({ code: '200', message: '', data });

export const tokenHandlers = [
	// GET /api/tokens — list all tokens
	http.get('*/api/tokens', async () => {
		await delay(300);
		return HttpResponse.json(envelope(mockTokens));
	}),

	// POST /api/tokens — create a token
	http.post('*/api/tokens', async ({ request }) => {
		await delay(400);
		const body = (await request.json()) as {
			name: string;
			scopes: string[];
			ttl_days: number;
		};

		if (!body.name?.trim()) {
			return HttpResponse.json(
				{ code: '12001', message: 'name is required' },
				{ status: 400 }
			);
		}

		if (mockTokens.length >= 5) {
			return HttpResponse.json(
				{ code: '12002', message: 'token limit reached' },
				{ status: 403 }
			);
		}

		const id = `tk_${nextId++}`;
		const rawToken = generateTokenValue();
		const item = {
			id,
			name: body.name.trim(),
			last4: rawToken.slice(-4),
			scopes: body.scopes,
			last_used_at: null,
			expires_at: futureDate(body.ttl_days),
			created_at: new Date().toISOString(),
		};
		mockTokens.push(item);

		return HttpResponse.json(
			envelope({
				raw_token: rawToken,
				token: {
					id,
					name: body.name.trim(),
					last4: rawToken.slice(-4),
					scopes: body.scopes,
					expires_at: item.expires_at,
					created_at: item.created_at,
				},
			})
		);
	}),

	// DELETE /api/tokens/:id — revoke a token
	http.delete('*/api/tokens/:id', async ({ params }) => {
		await delay(200);
		const { id } = params;
		const idx = mockTokens.findIndex((t) => t.id === id);
		if (idx === -1) {
			return HttpResponse.json(
				{ code: '12004', message: 'token not found' },
				{ status: 404 }
			);
		}
		mockTokens.splice(idx, 1);
		return new HttpResponse(null, { status: 204 });
	}),

	// POST /api/tokens/:id/rotate — rotate a token
	http.post('*/api/tokens/:id/rotate', async ({ params, request }) => {
		await delay(400);
		const { id } = params;
		const body = (await request.json()) as { ttl_days: number };
		const item = mockTokens.find((t) => t.id === id);
		if (!item) {
			return HttpResponse.json(
				{ code: '12004', message: 'token not found' },
				{ status: 404 }
			);
		}

		const newToken = generateTokenValue();
		item.last4 = newToken.slice(-4);
		item.expires_at = futureDate(body.ttl_days);

		return HttpResponse.json(
			envelope({
				raw_token: newToken,
				token: {
					id: item.id,
					name: item.name,
					last4: newToken.slice(-4),
					scopes: item.scopes,
					expires_at: item.expires_at,
					created_at: new Date().toISOString(),
				},
			})
		);
	}),
];
