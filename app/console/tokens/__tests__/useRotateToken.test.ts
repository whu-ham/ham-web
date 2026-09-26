/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:32:00
 *
 * Unit tests for useRotateToken — the TTL input, submit path and modal
 * state behind the rotate dialog.
 *
 * Rotation replaces the secret a caller is using, so the new raw token has
 * to be published and the list refetched in the same beat: a rotate whose
 * reveal is lost leaves the user holding a token they can no longer read,
 * and a rotate that does not bump the list version leaves the old `last4`
 * on screen. The tests pin that pair, plus the TTL bounds (an emptied
 * field leaves NaN behind, which used to be forwarded as `null`) and every
 * failure path the toast has to explain.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `useTranslations` is the only next-intl API the hook touches; mapping a
// key to itself keeps assertions on the toast independent of the catalogs.
vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({
	default: {
		error: (...args: unknown[]) => toastError(...args),
		success: (...args: unknown[]) => toastSuccess(...args),
	},
}));

// Only the service layer is mocked. `ApiError` has to stay the real class:
// the hook decides which message to show with `e instanceof ApiError`, and
// a stand-in class would quietly send every failure down the generic path.
const tokenRotate = vi.fn();
vi.mock('@/services/token/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/token/api')>();
	return {
		...actual,
		TokenApi: {
			...actual.TokenApi,
			rotate: (...a: unknown[]) => tokenRotate(...a),
		},
	};
});

import {
	newlyCreatedTokenAtom,
	rotateModalAtom,
	tokenListVersionAtom,
} from '@/app/console/tokens/store';
import { useRotateToken } from '@/app/console/tokens/useRotateToken';
import { ApiError } from '@/services/token/api';
import type { CreateTokenResponse } from '@/services/token/api';

const store = getDefaultStore();

const ROTATED: CreateTokenResponse = {
	raw_token: 'ham_sk_live_rotated',
	token: {
		id: 'tok_1',
		name: 'ci',
		last4: 'efgh',
		scopes: ['mcp'],
		expires_at: '2026-10-26T00:00:00Z',
		created_at: '2026-9-26T00:00:00Z',
	},
};

const renderRotateToken = () => renderHook(() => useRotateToken());

/** A promise whose settlement the test controls. */
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const resetAtoms = () => {
	store.set(rotateModalAtom, { visible: false, tokenId: null });
	store.set(newlyCreatedTokenAtom, null);
	store.set(tokenListVersionAtom, 0);
};

/** Open the dialog the way the list does, through the shared atom. */
const openModal = (tokenId: string) => {
	store.set(rotateModalAtom, { visible: true, tokenId });
};

describe('useRotateToken — initial state', () => {
	beforeEach(() => {
		tokenRotate.mockReset();
		toastError.mockReset();
		toastSuccess.mockReset();
		resetAtoms();
	});

	it('starts closed with the default ttl', () => {
		const { result } = renderRotateToken();

		expect(result.current.rotateModal).toEqual({
			visible: false,
			tokenId: null,
		});
		expect(result.current.ttl).toBe(30);
		expect(result.current.submitting).toBe(false);
	});
});

describe('useRotateToken — validation', () => {
	beforeEach(() => {
		tokenRotate.mockReset();
		toastError.mockReset();
		toastSuccess.mockReset();
		resetAtoms();
	});

	it('does nothing when no token is being rotated', async () => {
		const { result } = renderRotateToken();

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(tokenRotate).not.toHaveBeenCalled();
		expect(toastError).not.toHaveBeenCalled();
	});

	it.each([0, 31, Number.NaN])('rejects a ttl of %s', (ttl) => {
		openModal('tok_1');
		const { result } = renderRotateToken();

		act(() => {
			result.current.setTtl(ttl);
		});
		act(() => {
			void result.current.handleSubmit();
		});

		// NaN matters: an emptied number field leaves NaN behind, and every
		// comparison against NaN is false — so it used to sail through and
		// serialise to `null` in the request body.
		expect(toastError).toHaveBeenCalledWith('validation.ttlRange');
		expect(tokenRotate).not.toHaveBeenCalled();
		expect(result.current.submitting).toBe(false);
	});

	it.each([1, 30])('accepts a ttl of %s', async (ttl) => {
		tokenRotate.mockResolvedValue(ROTATED);
		openModal('tok_1');
		const { result } = renderRotateToken();

		act(() => {
			result.current.setTtl(ttl);
		});
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(tokenRotate).toHaveBeenCalledWith('tok_1', { ttl_days: ttl });
	});
});

describe('useRotateToken — submission', () => {
	beforeEach(() => {
		tokenRotate.mockReset();
		toastError.mockReset();
		toastSuccess.mockReset();
		resetAtoms();
	});

	it('reveals the new raw token once and bumps the list version', async () => {
		tokenRotate.mockResolvedValue(ROTATED);
		openModal('tok_1');
		const { result } = renderRotateToken();

		act(() => {
			result.current.setTtl(14);
		});
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(tokenRotate).toHaveBeenCalledWith('tok_1', { ttl_days: 14 });
		expect(store.get(newlyCreatedTokenAtom)).toEqual(ROTATED);
		expect(store.get(tokenListVersionAtom)).toBe(1);
		expect(toastSuccess).toHaveBeenCalledWith('rotateModal.success');
		// The dialog closes and the ttl resets, so the next rotate does not
		// inherit a value the user never typed.
		expect(result.current.rotateModal).toEqual({
			visible: false,
			tokenId: null,
		});
		expect(result.current.ttl).toBe(30);
		expect(result.current.submitting).toBe(false);
	});

	it('surfaces the backend message for an api error', async () => {
		tokenRotate.mockRejectedValue(
			new ApiError(400, { code: '12005', message: 'token is revoked' })
		);
		openModal('tok_1');
		const { result } = renderRotateToken();

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('token is revoked');
		expect(store.get(tokenListVersionAtom)).toBe(0);
		expect(store.get(newlyCreatedTokenAtom)).toBe(null);
		// A failed rotate leaves the dialog open so the user can retry.
		expect(result.current.rotateModal).toEqual({
			visible: true,
			tokenId: 'tok_1',
		});
		expect(result.current.submitting).toBe(false);
	});

	it('falls back to the generic message when the api error is blank', async () => {
		tokenRotate.mockRejectedValue(
			new ApiError(500, { code: '15000', message: '' })
		);
		openModal('tok_1');
		const { result } = renderRotateToken();

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('error.rotateFailed');
	});

	it('falls back to the generic message for a non-api failure', async () => {
		tokenRotate.mockRejectedValue(new Error('network down'));
		openModal('tok_1');
		const { result } = renderRotateToken();

		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('error.rotateFailed');
		expect(store.get(tokenListVersionAtom)).toBe(0);
	});

	it('ignores a second submit while one is in flight', async () => {
		const pending = deferred<CreateTokenResponse>();
		tokenRotate.mockReturnValue(pending.promise);
		openModal('tok_1');
		const { result } = renderRotateToken();

		act(() => {
			void result.current.handleSubmit();
		});
		expect(result.current.submitting).toBe(true);
		act(() => {
			void result.current.handleSubmit();
		});

		expect(tokenRotate).toHaveBeenCalledTimes(1);

		await act(async () => {
			pending.resolve(ROTATED);
			await pending.promise;
		});
		await waitFor(() => expect(result.current.submitting).toBe(false));
	});

	it('drops a rotate that settles after unmount', async () => {
		const pending = deferred<CreateTokenResponse>();
		tokenRotate.mockReturnValue(pending.promise);
		openModal('tok_1');
		const { result, unmount } = renderRotateToken();

		act(() => {
			void result.current.handleSubmit();
		});
		unmount();

		await act(async () => {
			pending.resolve(ROTATED);
			await pending.promise;
		});

		expect(toastSuccess).not.toHaveBeenCalled();
		expect(store.get(newlyCreatedTokenAtom)).toBe(null);
		expect(store.get(tokenListVersionAtom)).toBe(0);
	});

	it('drops a rotate that fails after unmount', async () => {
		const pending = deferred<CreateTokenResponse>();
		tokenRotate.mockReturnValue(pending.promise);
		openModal('tok_1');
		const { result, unmount } = renderRotateToken();

		act(() => {
			void result.current.handleSubmit();
		});
		unmount();

		await act(async () => {
			pending.reject(new Error('network down'));
			await pending.promise.catch(() => undefined);
		});

		expect(toastError).not.toHaveBeenCalled();
	});
});

describe('useRotateToken — closing', () => {
	beforeEach(() => {
		tokenRotate.mockReset();
		toastError.mockReset();
		toastSuccess.mockReset();
		resetAtoms();
	});

	it('closes the dialog and restores the default ttl', () => {
		openModal('tok_1');
		const { result } = renderRotateToken();

		act(() => {
			result.current.setTtl(3);
		});
		act(() => {
			result.current.handleClose();
		});

		expect(result.current.rotateModal).toEqual({
			visible: false,
			tokenId: null,
		});
		expect(result.current.ttl).toBe(30);
	});
});
