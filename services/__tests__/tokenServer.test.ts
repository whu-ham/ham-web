/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the server-side token preload.
 *
 * The contract is the `null` return: `[]` means "this account has no
 * keys yet" and `null` means "the fetch failed", so the client can offer
 * a retry instead of rendering an empty state that looks like a
 * successful answer.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serverFetch } from '@/services/server-fetch';
import { fetchTokenList } from '@/services/token/server';
import type { TokenListItem } from '@/services/token/api';

vi.mock('@/services/server-fetch', () => ({
	serverFetch: vi.fn(),
}));

const mockedServerFetch = vi.mocked(serverFetch);

const okResult = (data: unknown, bodyIsJson = true) => ({
	response: new Response(null, { status: 200 }),
	data,
	errorEnvelope: {},
	bodyIsJson,
});

const TOKENS: TokenListItem[] = [
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

describe('fetchTokenList', () => {
	beforeEach(() => {
		mockedServerFetch.mockReset();
	});

	it('asks the backend for the token list', async () => {
		mockedServerFetch.mockResolvedValue(okResult(TOKENS));

		await expect(fetchTokenList()).resolves.toEqual(TOKENS);
		expect(mockedServerFetch).toHaveBeenCalledWith('/web/tokens');
	});

	it('returns an empty list when the backend has no tokens', async () => {
		mockedServerFetch.mockResolvedValue(okResult([]));

		// An empty array is a real answer, not a failure — the client
		// renders the "create your first key" state for it.
		await expect(fetchTokenList()).resolves.toEqual([]);
	});

	// A backend that answers an object instead of an array would blow up
	// the list view if it were passed through.
	it('returns an empty list when the payload is not an array', async () => {
		mockedServerFetch.mockResolvedValue(okResult({ tokens: TOKENS }));

		await expect(fetchTokenList()).resolves.toEqual([]);
	});

	it('returns null when the body is not JSON', async () => {
		mockedServerFetch.mockResolvedValue(okResult(null, false));

		// A gateway error page is the typical case: a 200 with HTML.
		await expect(fetchTokenList()).resolves.toBeNull();
	});

	it('returns null when the backend replies with an error status', async () => {
		mockedServerFetch.mockResolvedValue({
			response: new Response(null, { status: 502 }),
			data: { code: 'x', message: 'bad gateway' },
			errorEnvelope: { code: 'x', message: 'bad gateway' },
			bodyIsJson: true,
		});

		await expect(fetchTokenList()).resolves.toBeNull();
	});

	it('returns null when the request itself throws', async () => {
		mockedServerFetch.mockRejectedValue(
			new Error('HAM_BACKEND_ORIGIN is not configured')
		);

		await expect(fetchTokenList()).resolves.toBeNull();
	});
});
