/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:19:22
 *
 * Unit tests for useLogout — the one place that ends a session.
 *
 * The hook navigates from a `finally`, not from the happy path: a logout
 * request that fails (already-expired session, offline, 5xx) must still get
 * the user out of the authenticated UI, because a page that keeps rendering
 * as signed in is worse than a failed request. These tests pin that
 * guarantee, plus the stable callback identity consumers depend on when they
 * put the hook's result in a dependency array.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { push, logout } = vi.hoisted(() => ({
	push: vi.fn(),
	logout: vi.fn(),
}));

// The router object has to be stable across renders: `useLogout` wraps its
// callback in `useCallback([router])`, and a new object every render would
// hand consumers a new function every render.
const router = { push };
vi.mock('next/navigation', () => ({
	useRouter: () => router,
}));

vi.mock('@/services/sso/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/sso/api')>();
	return {
		...actual,
		WebAuthApi: { ...actual.WebAuthApi, logout },
	};
});

import { useLogout } from '@/hooks/useLogout';

describe('useLogout', () => {
	beforeEach(() => {
		push.mockReset();
		logout.mockReset();
	});

	it('logs out through the API and then navigates to the landing page', async () => {
		logout.mockResolvedValue(undefined);
		const { result } = renderHook(() => useLogout());

		await act(async () => {
			await result.current();
		});

		expect(logout).toHaveBeenCalledTimes(1);
		expect(push).toHaveBeenCalledWith('/');
	});

	it('still navigates when the logout request rejects', async () => {
		logout.mockRejectedValue(new Error('session already gone'));
		const { result } = renderHook(() => useLogout());

		await act(async () => {
			await expect(result.current()).rejects.toThrow('session already gone');
		});

		// The `finally` is the whole point of this hook: a failed logout must
		// not strand the user on a page that still renders as signed in.
		expect(push).toHaveBeenCalledWith('/');
	});

	it('returns the same callback across renders', () => {
		logout.mockResolvedValue(undefined);
		const { result, rerender } = renderHook(() => useLogout());
		const first = result.current;

		rerender();

		expect(result.current).toBe(first);
	});
});
