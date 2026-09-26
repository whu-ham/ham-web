/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for useTokenList — the fetch, refetch and mutation path behind
 * the token list.
 *
 * The behaviours that matter:
 *
 * 1. "Fetch failed" and "you have no tokens" are different screens. A failed
 *    fetch keeps whatever the list had and raises an error flag; an empty
 *    response is simply empty.
 * 2. The list refetches when the create/rotate version atom moves — and
 *    only then. A refetch on every render would loop; missing the bump
 *    leaves a just-created token invisible.
 * 3. Responses can land out of order or after unmount, so stale and
 *    post-unmount settlements have to be dropped rather than clobber the
 *    list or toast into a screen that no longer exists.
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
vi.mock('react-hot-toast', () => ({
	default: { error: (...args: unknown[]) => toastError(...args) },
}));

// Only the service layer is mocked, and only the two methods this hook
// calls. `ApiError` stays real so failure classification is not faked.
const tokenList = vi.fn();
const tokenRevoke = vi.fn();
vi.mock('@/services/token/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/token/api')>();
	return {
		...actual,
		TokenApi: {
			...actual.TokenApi,
			list: () => tokenList(),
			revoke: (...a: unknown[]) => tokenRevoke(...a),
		},
	};
});

import {
	createModalVisibleAtom,
	rotateModalAtom,
	tokenListErrorAtom,
	tokenListLoadingAtom,
	tokenListVersionAtom,
} from '@/app/console/tokens/store';
import { useTokenList } from '@/app/console/tokens/useTokenList';
import type { TokenListItem } from '@/services/token/api';

const store = getDefaultStore();

const token = (id: string): TokenListItem => ({
	id,
	name: `token ${id}`,
	last4: 'abcd',
	scopes: ['mcp'],
	last_used_at: null,
	expires_at: '2026-10-26T00:00:00Z',
	created_at: '2026-9-26T00:00:00Z',
});

const TOKENS = [token('tok_1'), token('tok_2')];
const NEWER = [token('tok_3')];

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

interface Snapshot {
	loading: boolean;
	tokens: TokenListItem[];
	fetchError: boolean;
}

/**
 * Render the hook while recording every render's public state. The first
 * entry is the pre-mount render — the one the server HTML has to match, so
 * it is the only place the hydration guard is observable.
 */
const renderTokenList = (initialTokens?: TokenListItem[] | null) => {
	const snapshots: Snapshot[] = [];
	const view = renderHook(() => {
		const value = useTokenList(initialTokens);
		snapshots.push({
			loading: value.loading,
			tokens: value.tokens,
			fetchError: value.fetchError,
		});
		return value;
	});
	return { ...view, snapshots };
};

const resetAtoms = () => {
	store.set(tokenListVersionAtom, 0);
	store.set(tokenListErrorAtom, false);
	store.set(tokenListLoadingAtom, true);
	store.set(createModalVisibleAtom, false);
	store.set(rotateModalAtom, { visible: false, tokenId: null });
};

describe('useTokenList', () => {
	beforeEach(() => {
		tokenList.mockReset();
		tokenRevoke.mockReset();
		toastError.mockReset();
		resetAtoms();
	});

	it('fetches on mount when the server sent nothing', async () => {
		tokenList.mockResolvedValue(TOKENS);
		const { result } = renderTokenList(null);

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(tokenList).toHaveBeenCalledTimes(1);
		expect(result.current.tokens).toEqual(TOKENS);
		expect(result.current.fetchError).toBe(false);
	});

	it('starts in the loading state on the render the server must match', () => {
		tokenList.mockResolvedValue(TOKENS);
		const { snapshots } = renderTokenList(null);

		expect(snapshots[0]).toEqual({
			loading: true,
			tokens: [],
			fetchError: false,
		});
	});

	it('seeds from the server payload without a fetch', async () => {
		const { result, snapshots } = renderTokenList(TOKENS);

		// The first client render has to reproduce the server HTML: the
		// skeleton must not flash over a list the server already sent.
		expect(snapshots[0]).toEqual({
			loading: false,
			tokens: TOKENS,
			fetchError: false,
		});
		expect(tokenList).not.toHaveBeenCalled();
		await waitFor(() => expect(result.current.tokens).toEqual(TOKENS));
		expect(result.current.loading).toBe(false);
	});

	it('applies the server seed once, so a re-render cannot clobber the list', async () => {
		const { result, rerender } = renderHook(
			(props: { tokens: TokenListItem[] }) => useTokenList(props.tokens),
			{ initialProps: { tokens: TOKENS } }
		);

		rerender({ tokens: NEWER });

		expect(result.current.tokens).toEqual(TOKENS);
		expect(tokenList).not.toHaveBeenCalled();
	});

	it('degrades a malformed server payload to an empty list', async () => {
		const { result } = renderTokenList({} as unknown as TokenListItem[]);

		expect(result.current.tokens).toEqual([]);
		expect(result.current.loading).toBe(false);
		expect(tokenList).not.toHaveBeenCalled();
	});

	it('distinguishes a failed fetch from an empty list', async () => {
		tokenList.mockRejectedValue(new Error('backend down'));
		const { result } = renderTokenList(null);

		await waitFor(() => expect(result.current.fetchError).toBe(true));

		expect(toastError).toHaveBeenCalledWith('error.fetchFailed');
		expect(result.current.loading).toBe(false);
		expect(result.current.tokens).toEqual([]);
	});

	it('treats an empty response as no tokens, not as a failure', async () => {
		tokenList.mockResolvedValue([]);
		const { result } = renderTokenList(null);

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.tokens).toEqual([]);
		expect(result.current.fetchError).toBe(false);
		expect(toastError).not.toHaveBeenCalled();
	});

	it('refetches when the list version moves', async () => {
		tokenList.mockResolvedValue(TOKENS);
		const { result } = renderTokenList(null);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(tokenList).toHaveBeenCalledTimes(1);

		// A create or rotate succeeded: the list has to catch up.
		tokenList.mockResolvedValue(NEWER);
		act(() => {
			store.set(tokenListVersionAtom, 1);
		});

		await waitFor(() => expect(tokenList).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(result.current.tokens).toEqual(NEWER));
	});

	it('does not refetch while the list version is unchanged', async () => {
		tokenList.mockResolvedValue(TOKENS);
		const { result, rerender } = renderTokenList(null);
		await waitFor(() => expect(result.current.loading).toBe(false));

		rerender();
		rerender();

		expect(tokenList).toHaveBeenCalledTimes(1);
	});

	it('refetches on demand', async () => {
		tokenList.mockResolvedValue(TOKENS);
		const { result } = renderTokenList(null);
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			await result.current.fetchTokens();
		});

		expect(tokenList).toHaveBeenCalledTimes(2);
	});

	it('discards a response that a newer fetch has superseded', async () => {
		const calls = [deferred<TokenListItem[]>(), deferred<TokenListItem[]>()];
		tokenList
			.mockImplementationOnce(() => calls[0].promise)
			.mockImplementationOnce(() => calls[1].promise);
		const { result } = renderTokenList(null);
		act(() => {
			void result.current.fetchTokens();
		});
		expect(tokenList).toHaveBeenCalledTimes(2);

		await act(async () => {
			calls[1].resolve(NEWER);
			await calls[1].promise;
		});
		await act(async () => {
			calls[0].resolve(TOKENS);
			await calls[0].promise;
		});

		expect(result.current.tokens).toEqual(NEWER);
		expect(result.current.loading).toBe(false);
	});

	it('discards a failure that a newer fetch has superseded', async () => {
		const calls = [deferred<TokenListItem[]>(), deferred<TokenListItem[]>()];
		tokenList
			.mockImplementationOnce(() => calls[0].promise)
			.mockImplementationOnce(() => calls[1].promise);
		const { result } = renderTokenList(null);
		act(() => {
			void result.current.fetchTokens();
		});

		await act(async () => {
			calls[1].resolve(NEWER);
			await calls[1].promise;
		});
		await act(async () => {
			calls[0].reject(new Error('backend down'));
			await calls[0].promise.catch(() => undefined);
		});

		expect(result.current.tokens).toEqual(NEWER);
		expect(result.current.fetchError).toBe(false);
		expect(toastError).not.toHaveBeenCalled();
	});

	it('drops a response that arrives after unmount', async () => {
		const pending = deferred<TokenListItem[]>();
		tokenList.mockReturnValue(pending.promise);
		const { unmount } = renderTokenList(null);

		unmount();
		await act(async () => {
			pending.resolve(TOKENS);
			await pending.promise;
		});

		expect(store.get(tokenListLoadingAtom)).toBe(true);
		expect(store.get(tokenListErrorAtom)).toBe(false);
	});

	it('drops a failure that arrives after unmount', async () => {
		const pending = deferred<TokenListItem[]>();
		tokenList.mockReturnValue(pending.promise);
		const { unmount } = renderTokenList(null);

		unmount();
		await act(async () => {
			pending.reject(new Error('backend down'));
			await pending.promise.catch(() => undefined);
		});

		expect(toastError).not.toHaveBeenCalled();
		expect(store.get(tokenListErrorAtom)).toBe(false);
	});

	it('removes a revoked token from the list', async () => {
		tokenRevoke.mockResolvedValue(undefined);
		const { result } = renderTokenList(TOKENS);

		await act(async () => {
			await result.current.handleRevoke('tok_2');
		});

		expect(tokenRevoke).toHaveBeenCalledWith('tok_2');
		expect(result.current.tokens.map((tk) => tk.id)).toEqual(['tok_1']);
		expect(toastError).not.toHaveBeenCalled();
	});

	it('keeps the token in the list when revoke fails', async () => {
		tokenRevoke.mockRejectedValue(new Error('backend down'));
		const { result } = renderTokenList(TOKENS);

		await act(async () => {
			await result.current.handleRevoke('tok_2');
		});

		expect(toastError).toHaveBeenCalledWith('error.revokeFailed');
		expect(result.current.tokens.map((tk) => tk.id)).toEqual([
			'tok_1',
			'tok_2',
		]);
	});

	it('opens the rotate modal for the chosen token', () => {
		const { result } = renderTokenList(TOKENS);

		act(() => {
			result.current.handleRotate('tok_2');
		});

		expect(store.get(rotateModalAtom)).toEqual({
			visible: true,
			tokenId: 'tok_2',
		});
	});

	it('opens the create modal on request', () => {
		const { result } = renderTokenList(TOKENS);

		act(() => {
			result.current.setCreateModalVisible(true);
		});

		expect(store.get(createModalVisibleAtom)).toBe(true);
	});
});
