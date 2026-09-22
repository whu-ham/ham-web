/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/23 00:17:03
 *
 * Unit tests for serverFetch — defensive body parsing.
 *
 * The backend replies are not uniformly JSON: a 204 carries no body at
 * all and a gateway error page answers an HTML document instead. Letting
 * `response.json()` reject on those turned "the backend said nothing"
 * into a network failure that surfaced as a misleading error on the
 * login and consent screens.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
	cookies: async () => ({
		get: () => undefined,
		getAll: () => [],
		set: () => undefined,
	}),
}));

import { serverFetch } from '@/services/server-fetch';

const stubFetch = (init: { status: number; body?: string }) => {
	const fetch = vi.fn(
		async () => new Response(init.body ?? null, { status: init.status })
	);
	vi.stubGlobal('fetch', fetch);
	return fetch;
};

describe('serverFetch', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns null for a 204 No Content reply', async () => {
		stubFetch({ status: 204 });

		const { data, errorEnvelope } = await serverFetch('/web/auth/logout', {
			method: 'POST',
		});

		expect(data).toBeNull();
		expect(errorEnvelope).toEqual({});
	});

	it('returns null for an empty 200 body', async () => {
		stubFetch({ status: 200, body: '' });

		const { data } = await serverFetch('/web/tokens');

		expect(data).toBeNull();
	});

	it('returns null for a non-JSON body instead of throwing', async () => {
		stubFetch({ status: 200, body: '<html>gateway error</html>' });

		const { data } = await serverFetch('/web/tokens');

		expect(data).toBeNull();
	});

	it('unwraps the backend error envelope on failure', async () => {
		stubFetch({
			status: 400,
			body: JSON.stringify({ code: '12002', message: 'token limit reached' }),
		});

		const { response, errorEnvelope } = await serverFetch('/web/tokens', {
			method: 'POST',
		});

		expect(response.ok).toBe(false);
		expect(errorEnvelope).toEqual({
			code: '12002',
			message: 'token limit reached',
		});
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('keeps raw JSON payloads untouched', async () => {
		stubFetch({ status: 200, body: JSON.stringify([{ id: 'tok_1' }]) });

		const { data } = await serverFetch<{ id: string }[]>('/web/tokens');

		expect(data).toEqual([{ id: 'tok_1' }]);
	});
});
