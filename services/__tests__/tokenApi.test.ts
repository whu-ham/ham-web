/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the API-token HTTP client.
 *
 * The token id travels in the path, so it is asserted after encoding: an
 * id containing `/` or a space would otherwise address a different
 * endpoint — or, worse, an unintended one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_BASE } from '@/services/shared';
import {
	TokenApi,
	VALID_SCOPES,
	type CreateTokenRequest,
} from '@/services/token/api';

type FetchInit = RequestInit & { headers: Record<string, string> };

const stubFetch = (body: unknown, status = 200) => {
	// 204 must not carry a body: the Response constructor rejects a
	// non-null body on a status that is defined to have none.
	const fetchMock = vi.fn(
		async () =>
			new Response(status === 204 ? null : JSON.stringify(body), {
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

const TOKEN_LIST = [
	{
		id: 'tok_1',
		name: 'ci',
		last4: 'abcd',
		scopes: ['mcp:read'],
		last_used_at: null,
		expires_at: '2026-10-01T00:00:00Z',
		created_at: '2026-09-01T00:00:00Z',
	},
];

describe('TokenApi', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('lists the tokens', async () => {
		const fetchMock = stubFetch(TOKEN_LIST);

		await expect(TokenApi.list()).resolves.toEqual(TOKEN_LIST);

		const [url, init] = lastCall(fetchMock);
		expect(url).toBe(`${API_BASE}/tokens`);
		expect(init.method).toBeUndefined();
	});

	it('creates a token', async () => {
		const fetchMock = stubFetch({
			raw_token: 'ham_raw',
			token: TOKEN_LIST[0],
		});
		const body: CreateTokenRequest = {
			name: 'ci',
			scopes: ['mcp', 'mcp:read'],
			ttl_days: 30,
		};

		await expect(TokenApi.create(body)).resolves.toEqual({
			raw_token: 'ham_raw',
			token: TOKEN_LIST[0],
		});

		const [url, init] = lastCall(fetchMock);
		expect(url).toBe(`${API_BASE}/tokens`);
		expect(init.method).toBe('POST');
		expect(init.body).toBe(JSON.stringify(body));
		expect(init.headers['Content-Type']).toBe('application/json');
	});

	it('rotates a token', async () => {
		const fetchMock = stubFetch({
			raw_token: 'ham_raw2',
			token: TOKEN_LIST[0],
		});

		await TokenApi.rotate('tok_1', { ttl_days: 60 });

		const [url, init] = lastCall(fetchMock);
		expect(url).toBe(`${API_BASE}/tokens/tok_1/rotate`);
		expect(init.method).toBe('POST');
		expect(init.body).toBe(JSON.stringify({ ttl_days: 60 }));
	});

	// The id is a path segment, so it has to be encoded — a raw `/` would
	// turn the rotate call into a request for a different route.
	it('URL-encodes the id it rotates', async () => {
		const fetchMock = stubFetch({ raw_token: 'x', token: TOKEN_LIST[0] });

		await TokenApi.rotate('tok/1 ?', { ttl_days: 1 });

		expect(lastCall(fetchMock)[0]).toBe(
			`${API_BASE}/tokens/tok%2F1%20%3F/rotate`
		);
	});

	it('revokes a token', async () => {
		const fetchMock = stubFetch(null, 204);

		await expect(TokenApi.revoke('tok_1')).resolves.toBeUndefined();

		const [url, init] = lastCall(fetchMock);
		expect(url).toBe(`${API_BASE}/tokens/tok_1`);
		expect(init.method).toBe('DELETE');
	});

	it('URL-encodes the id it revokes', async () => {
		const fetchMock = stubFetch(null, 204);

		await TokenApi.revoke('tok/1 ?');

		expect(lastCall(fetchMock)[0]).toBe(`${API_BASE}/tokens/tok%2F1%20%3F`);
	});
});

describe('VALID_SCOPES', () => {
	it('lists the scopes the UI offers', () => {
		expect(VALID_SCOPES).toEqual(['mcp', 'mcp:read', 'mcp:write']);
	});
});
