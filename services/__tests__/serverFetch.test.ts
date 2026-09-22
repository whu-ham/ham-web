/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/23 01:31:52
 *
 * Unit tests for serverFetch — defensive body parsing.
 *
 * The backend replies are not uniformly JSON: a 204 carries no body at
 * all and a gateway error page answers an HTML document instead. Letting
 * `response.json()` reject on those turned "the backend said nothing"
 * into a network failure that surfaced as a misleading error on the
 * login and consent screens.
 *
 * The parse flag is what keeps that from going the other way: a 200 that
 * carries no JSON must not be reported as an empty payload, or a
 * signed-in user gets bounced to /login.
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

		const { data, errorEnvelope, bodyIsJson } = await serverFetch(
			'/web/auth/logout',
			{ method: 'POST' }
		);

		expect(data).toBeNull();
		expect(bodyIsJson).toBe(false);
		expect(errorEnvelope).toEqual({});
	});

	it('returns null for an empty 200 body', async () => {
		stubFetch({ status: 200, body: '' });

		const { data, bodyIsJson } = await serverFetch('/web/tokens');

		expect(data).toBeNull();
		expect(bodyIsJson).toBe(false);
	});

	it('returns null for a non-JSON body instead of throwing', async () => {
		stubFetch({ status: 200, body: '<html>gateway error</html>' });

		// The 200 is the dangerous case: without the flag a caller cannot
		// tell this apart from a genuinely empty payload.
		const { data, bodyIsJson } = await serverFetch('/web/tokens');

		expect(data).toBeNull();
		expect(bodyIsJson).toBe(false);
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

		const { data, bodyIsJson } =
			await serverFetch<{ id: string }[]>('/web/tokens');

		expect(data).toEqual([{ id: 'tok_1' }]);
		expect(bodyIsJson).toBe(true);
	});

	it('reports a JSON null payload as parsed', async () => {
		stubFetch({ status: 200, body: 'null' });

		const { data, bodyIsJson } = await serverFetch('/web/tokens');

		expect(data).toBeNull();
		expect(bodyIsJson).toBe(true);
	});
});
