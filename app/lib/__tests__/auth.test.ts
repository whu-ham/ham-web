/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:25:31
 *
 * Unit tests for the Server-Component auth helpers.
 *
 * The two paths out of `fetchMe` are not interchangeable. Returning
 * `null` for a 5xx sends a visitor who does have a session to /login and
 * hides a backend outage; throwing on a 401 turns every anonymous visit
 * into a stack trace. `requireAuth` is where that distinction meets the
 * router, so both outcomes are pinned here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { serverFetch, redirect } = vi.hoisted(() => ({
	serverFetch: vi.fn(),
	redirect: vi.fn(),
}));

vi.mock('@/services/server-fetch', () => ({ serverFetch }));
// next/navigation's redirect throws a sentinel to unwind the render; the
// mock lets the assertion look at the URL instead.
vi.mock('next/navigation', () => ({ redirect }));

import type { MeResponse } from '@/services/sso/api';
import { fetchMe, requireAuth } from '@/app/lib/auth';

interface Reply {
	status: number;
	data?: unknown;
	bodyIsJson?: boolean;
}

const stubMe = ({ status, data = null, bodyIsJson = true }: Reply) => {
	serverFetch.mockResolvedValue({
		response: { status, ok: status >= 200 && status < 300 } as Response,
		data,
		bodyIsJson,
		errorEnvelope: {},
	});
};

const me: MeResponse = { user_id: 'u_1', nickname: 'Ada' };

describe('fetchMe', () => {
	beforeEach(() => {
		serverFetch.mockReset();
	});

	it('asks the backend for the current user', async () => {
		stubMe({ status: 200, data: me });

		await expect(fetchMe()).resolves.toEqual(me);
		expect(serverFetch).toHaveBeenCalledWith('/web/auth/me');
	});

	it('reports an expired session as unauthenticated', async () => {
		stubMe({ status: 401 });

		await expect(fetchMe()).resolves.toBeNull();
	});

	it('reports a forbidden session as unauthenticated', async () => {
		stubMe({ status: 403 });

		await expect(fetchMe()).resolves.toBeNull();
	});

	// A 5xx is not "no user": it is a backend that failed to answer.
	// Throwing lets the error boundary show it instead of silently
	// bouncing a signed-in visitor to /login.
	it('throws on a server error so the error boundary handles it', async () => {
		stubMe({ status: 500 });

		await expect(fetchMe()).rejects.toThrow('fetchMe failed: 500');
	});

	it('throws on any other failure status', async () => {
		stubMe({ status: 404 });

		await expect(fetchMe()).rejects.toThrow('fetchMe failed: 404');
	});

	// An HTML gateway page parses to `null`, and `null` means "not signed
	// in" — which would log the visitor out because of a proxy hiccup.
	it('throws when a 200 carries no JSON', async () => {
		stubMe({ status: 200, bodyIsJson: false });

		await expect(fetchMe()).rejects.toThrow(
			'fetchMe failed: non-JSON response'
		);
	});
});

describe('requireAuth', () => {
	beforeEach(() => {
		serverFetch.mockReset();
		redirect.mockReset();
	});

	it('returns the user when the session is valid', async () => {
		stubMe({ status: 200, data: me });

		await expect(requireAuth('/console')).resolves.toEqual(me);
		expect(redirect).not.toHaveBeenCalled();
	});

	it('redirects to /login carrying the encoded return path', async () => {
		stubMe({ status: 401 });

		await requireAuth('/console/tokens');

		expect(redirect).toHaveBeenCalledWith('/login?from=%2Fconsole%2Ftokens');
	});

	it('encodes a path with a query string as a single parameter', async () => {
		stubMe({ status: 401 });

		await requireAuth('/console?tab=all');

		expect(redirect).toHaveBeenCalledWith('/login?from=%2Fconsole%3Ftab%3Dall');
	});
});
