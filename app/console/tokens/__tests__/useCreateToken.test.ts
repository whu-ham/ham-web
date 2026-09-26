/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:25:00
 *
 * Unit tests for useCreateToken — the form state, validation and submit
 * path behind the create-token modal.
 *
 * Three behaviours are load-bearing here.
 *
 * 1. The scope checkboxes form a parent/child group and the request carries
 *    the *normalised* selection — the parent scope alone once the group is
 *    complete. A wrong selection silently grants the wrong access, so the
 *    tests drive `handleScopeChange` and then assert the payload that
 *    reaches `TokenApi.create`.
 * 2. An empty selection is a real answer. It used to be read as "the user
 *    has not chosen yet" and get replaced with every scope (the regression
 *    pinned in commit 14a54fd), which would grant access the user had just
 *    removed.
 * 3. A raw token is shown exactly once, so a successful create has to
 *    publish it, bump the list version and close the modal as one unit —
 *    otherwise the list refetches without the reveal, or vice versa.
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
const tokenCreate = vi.fn();
vi.mock('@/services/token/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/token/api')>();
	return {
		...actual,
		TokenApi: {
			...actual.TokenApi,
			create: (...a: unknown[]) => tokenCreate(...a),
		},
	};
});

import {
	CHILD_SCOPES,
	PARENT_SCOPE,
	useCreateToken,
} from '@/app/console/tokens/useCreateToken';
import {
	createModalVisibleAtom,
	newlyCreatedTokenAtom,
	tokenListVersionAtom,
} from '@/app/console/tokens/store';
import { ApiError } from '@/services/token/api';
import type { CreateTokenResponse } from '@/services/token/api';

const store = getDefaultStore();

const CREATED: CreateTokenResponse = {
	raw_token: 'ham_sk_live_raw',
	token: {
		id: 'tok_1',
		name: 'ci',
		last4: 'abcd',
		scopes: ['mcp'],
		expires_at: '2026-10-26T00:00:00Z',
		created_at: '2026-9-26T00:00:00Z',
	},
};

const renderCreateToken = () => renderHook(() => useCreateToken());

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

/** Fill in a form that passes every validation gate. */
const fillValidForm = (result: {
	current: ReturnType<typeof useCreateToken>;
}) => {
	act(() => {
		result.current.setName('ci token');
	});
	act(() => {
		result.current.handleScopeChange(PARENT_SCOPE, true);
	});
};

const resetAtoms = () => {
	store.set(createModalVisibleAtom, false);
	store.set(newlyCreatedTokenAtom, null);
	store.set(tokenListVersionAtom, 0);
};

describe('useCreateToken — initial state', () => {
	beforeEach(() => {
		tokenCreate.mockReset();
		toastError.mockReset();
		toastSuccess.mockReset();
		resetAtoms();
	});

	it('opens with an empty form, a closed modal and the default ttl', () => {
		const { result } = renderCreateToken();

		expect(result.current.visible).toBe(false);
		expect(result.current.name).toBe('');
		expect(result.current.scopes).toEqual([]);
		expect(result.current.ttl).toBe(30);
		expect(result.current.submitting).toBe(false);
		expect(result.current.isParentChecked).toBe(false);
		expect(result.current.isParentIndeterminate).toBe(false);
	});
});

describe('useCreateToken — scope selection', () => {
	beforeEach(() => {
		tokenCreate.mockReset();
		toastError.mockReset();
		toastSuccess.mockReset();
		resetAtoms();
	});

	it('checking the parent scope selects every child scope', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});

		expect(result.current.scopes).toEqual([PARENT_SCOPE, ...CHILD_SCOPES]);
		expect(result.current.isParentChecked).toBe(true);
		expect(result.current.isParentIndeterminate).toBe(false);
	});

	it('unchecking the parent scope clears the whole group', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, false);
		});

		expect(result.current.scopes).toEqual([]);
		expect(result.current.isParentChecked).toBe(false);
		expect(result.current.isParentIndeterminate).toBe(false);
	});

	it('checking every child auto-checks the parent', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.handleScopeChange(CHILD_SCOPES[0], true);
		});
		// A partial group is an indeterminate parent, not a checked one.
		expect(result.current.isParentChecked).toBe(false);
		expect(result.current.isParentIndeterminate).toBe(true);

		act(() => {
			result.current.handleScopeChange(CHILD_SCOPES[1], true);
		});

		expect(result.current.isParentChecked).toBe(true);
		expect(result.current.isParentIndeterminate).toBe(false);
	});

	it('unchecking one child unchecks the parent but keeps the others', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
		act(() => {
			result.current.handleScopeChange(CHILD_SCOPES[1], false);
		});

		expect(result.current.scopes).toEqual([CHILD_SCOPES[0]]);
		expect(result.current.isParentChecked).toBe(false);
		expect(result.current.isParentIndeterminate).toBe(true);
	});

	it('keeps a deliberately empty selection empty', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
		CHILD_SCOPES.forEach((scope) => {
			act(() => {
				result.current.handleScopeChange(scope, false);
			});
		});

		// An empty selection is an answer, not "not chosen yet": it must not
		// be topped up with every scope again.
		expect(result.current.scopes).toEqual([]);
		expect(result.current.isParentChecked).toBe(false);
		expect(result.current.isParentIndeterminate).toBe(false);

		act(() => {
			result.current.setName('ci token');
		});
		act(() => {
			void result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('validation.scopesRequired');
		expect(tokenCreate).not.toHaveBeenCalled();
	});

	it('re-checking a selected child leaves the group selected', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
		act(() => {
			result.current.handleScopeChange(CHILD_SCOPES[0], true);
		});

		expect(result.current.isParentChecked).toBe(true);
		expect(result.current.isParentIndeterminate).toBe(false);
	});
});

describe('useCreateToken — validation', () => {
	beforeEach(() => {
		tokenCreate.mockReset();
		toastError.mockReset();
		toastSuccess.mockReset();
		resetAtoms();
	});

	it('rejects a blank name', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.setName('   ');
		});
		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
		act(() => {
			void result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('validation.nameRequired');
		expect(tokenCreate).not.toHaveBeenCalled();
		expect(result.current.submitting).toBe(false);
	});

	it('rejects a name longer than 128 characters', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.setName('a'.repeat(129));
		});
		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
		act(() => {
			void result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('validation.nameTooLong');
		expect(tokenCreate).not.toHaveBeenCalled();
	});

	it('accepts a name of exactly 128 characters', async () => {
		tokenCreate.mockResolvedValue(CREATED);
		const { result } = renderCreateToken();

		act(() => {
			result.current.setName('a'.repeat(128));
		});
		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).not.toHaveBeenCalled();
		expect(tokenCreate).toHaveBeenCalledTimes(1);
	});

	it('rejects a submission with no scope selected', () => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.setName('ci token');
		});
		act(() => {
			void result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('validation.scopesRequired');
		expect(tokenCreate).not.toHaveBeenCalled();
	});

	it.each([0, 31, Number.NaN])('rejects a ttl of %s', (ttl) => {
		const { result } = renderCreateToken();

		act(() => {
			result.current.setName('ci token');
		});
		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
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
		expect(tokenCreate).not.toHaveBeenCalled();
	});

	it.each([1, 30])('accepts a ttl of %s', async (ttl) => {
		tokenCreate.mockResolvedValue(CREATED);
		const { result } = renderCreateToken();

		act(() => {
			result.current.setName('ci token');
		});
		act(() => {
			result.current.handleScopeChange(PARENT_SCOPE, true);
		});
		act(() => {
			result.current.setTtl(ttl);
		});
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(tokenCreate).toHaveBeenCalledWith(
			expect.objectContaining({ ttl_days: ttl })
		);
	});
});

describe('useCreateToken — submission', () => {
	beforeEach(() => {
		tokenCreate.mockReset();
		toastError.mockReset();
		toastSuccess.mockReset();
		resetAtoms();
	});

	it('sends the trimmed name, the normalised scopes and the ttl', async () => {
		tokenCreate.mockResolvedValue(CREATED);
		const { result } = renderCreateToken();

		act(() => {
			result.current.setName('  ci token  ');
		});
		act(() => {
			result.current.handleScopeChange(CHILD_SCOPES[0], true);
		});
		act(() => {
			result.current.setTtl(7);
		});
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(tokenCreate).toHaveBeenCalledWith({
			name: 'ci token',
			scopes: [CHILD_SCOPES[0]],
			ttl_days: 7,
		});
	});

	it('sends only the parent scope once the whole group is selected', async () => {
		tokenCreate.mockResolvedValue(CREATED);
		const { result } = renderCreateToken();

		fillValidForm(result);
		await act(async () => {
			await result.current.handleSubmit();
		});

		// The UI shows three checked boxes; the backend gets the group.
		expect(tokenCreate).toHaveBeenCalledWith(
			expect.objectContaining({ scopes: [PARENT_SCOPE] })
		);
	});

	it('reveals the raw token once and bumps the list version', async () => {
		tokenCreate.mockResolvedValue(CREATED);
		const { result } = renderCreateToken();
		store.set(createModalVisibleAtom, true);

		fillValidForm(result);
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(store.get(newlyCreatedTokenAtom)).toEqual(CREATED);
		expect(store.get(tokenListVersionAtom)).toBe(1);
		expect(toastSuccess).toHaveBeenCalledWith('createModal.success');
		// The modal closes and the form resets, so the next create starts
		// clean instead of re-submitting the token name.
		expect(store.get(createModalVisibleAtom)).toBe(false);
		expect(result.current.name).toBe('');
		expect(result.current.scopes).toEqual([]);
		expect(result.current.ttl).toBe(30);
		expect(result.current.submitting).toBe(false);
	});

	it('surfaces the token-limit code from the backend', async () => {
		tokenCreate.mockRejectedValue(
			new ApiError(400, { code: '12002', message: 'too many tokens' })
		);
		const { result } = renderCreateToken();

		fillValidForm(result);
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('validation.tokenLimit');
		expect(store.get(tokenListVersionAtom)).toBe(0);
		expect(result.current.submitting).toBe(false);
	});

	it('surfaces a forbidden response as the token limit', async () => {
		tokenCreate.mockRejectedValue(new ApiError(403, { code: '403' }));
		const { result } = renderCreateToken();

		fillValidForm(result);
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('validation.tokenLimit');
	});

	it('surfaces the backend message for any other api error', async () => {
		tokenCreate.mockRejectedValue(
			new ApiError(500, { code: '15000', message: 'backend exploded' })
		);
		const { result } = renderCreateToken();

		fillValidForm(result);
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('backend exploded');
		expect(store.get(newlyCreatedTokenAtom)).toBe(null);
	});

	it('falls back to the generic message when the api error is blank', async () => {
		tokenCreate.mockRejectedValue(
			new ApiError(500, { code: '15000', message: '' })
		);
		const { result } = renderCreateToken();

		fillValidForm(result);
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('error.createFailed');
	});

	it('falls back to the generic message for a non-api failure', async () => {
		tokenCreate.mockRejectedValue(new Error('network down'));
		const { result } = renderCreateToken();

		fillValidForm(result);
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(toastError).toHaveBeenCalledWith('error.createFailed');
		expect(store.get(tokenListVersionAtom)).toBe(0);
		expect(result.current.submitting).toBe(false);
	});

	it('ignores a second submit while one is in flight', async () => {
		const pending = deferred<CreateTokenResponse>();
		tokenCreate.mockReturnValue(pending.promise);
		const { result } = renderCreateToken();

		fillValidForm(result);
		act(() => {
			void result.current.handleSubmit();
		});
		expect(result.current.submitting).toBe(true);
		act(() => {
			void result.current.handleSubmit();
		});

		expect(tokenCreate).toHaveBeenCalledTimes(1);

		await act(async () => {
			pending.resolve(CREATED);
			await pending.promise;
		});
		await waitFor(() => expect(result.current.submitting).toBe(false));
	});

	it('drops a create that settles after unmount', async () => {
		const pending = deferred<CreateTokenResponse>();
		tokenCreate.mockReturnValue(pending.promise);
		const { result, unmount } = renderCreateToken();

		fillValidForm(result);
		act(() => {
			void result.current.handleSubmit();
		});
		unmount();

		await act(async () => {
			pending.resolve(CREATED);
			await pending.promise;
		});

		expect(toastSuccess).not.toHaveBeenCalled();
		expect(store.get(newlyCreatedTokenAtom)).toBe(null);
		expect(store.get(tokenListVersionAtom)).toBe(0);
	});

	it('drops a create that fails after unmount', async () => {
		const pending = deferred<CreateTokenResponse>();
		tokenCreate.mockReturnValue(pending.promise);
		const { result, unmount } = renderCreateToken();

		fillValidForm(result);
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
