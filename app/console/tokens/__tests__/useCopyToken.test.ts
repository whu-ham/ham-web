/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 12:25:00
 *
 * Unit tests for useCopyToken — the clipboard path behind the token reveal
 * dialog.
 *
 * A raw token is shown exactly once, so a copy that silently fails leaves
 * the user with nothing to paste and no way to get the value back. The hook
 * therefore falls back to `execCommand`, and — when that fails too — has to
 * say so. These tests pin both fallbacks and the guard that keeps a second
 * click from re-arming the "copied" state.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
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

import { useCopyToken } from '@/app/console/tokens/useCopyToken';

const TOKEN = 'ham_sk_live_1234';

const stubClipboard = (writeText: () => Promise<void>) => {
	Object.defineProperty(navigator, 'clipboard', {
		value: { writeText },
		configurable: true,
		writable: true,
	});
};

describe('useCopyToken', () => {
	beforeEach(() => {
		toastError.mockReset();
		stubClipboard(vi.fn(async () => undefined));
	});

	it('copies through the clipboard API and flips the copied flag', async () => {
		const writeText = vi.fn(async () => undefined);
		stubClipboard(writeText);
		const { result } = renderHook(() => useCopyToken(TOKEN));

		expect(result.current.copied).toBe(false);

		await act(async () => {
			await result.current.handleCopy();
		});

		expect(writeText).toHaveBeenCalledWith(TOKEN);
		await waitFor(() => expect(result.current.copied).toBe(true));
	});

	it('does nothing when there is no token to copy', async () => {
		const writeText = vi.fn(async () => undefined);
		stubClipboard(writeText);
		const { result } = renderHook(() => useCopyToken(undefined));

		await act(async () => {
			await result.current.handleCopy();
		});

		expect(writeText).not.toHaveBeenCalled();
		expect(result.current.copied).toBe(false);
		expect(toastError).not.toHaveBeenCalled();
	});

	it('ignores a second copy once the token was copied', async () => {
		const writeText = vi.fn(async () => undefined);
		stubClipboard(writeText);
		const { result } = renderHook(() => useCopyToken(TOKEN));

		await act(async () => {
			await result.current.handleCopy();
		});
		await act(async () => {
			await result.current.handleCopy();
		});

		expect(writeText).toHaveBeenCalledTimes(1);
	});

	it('falls back to execCommand when the clipboard API rejects', async () => {
		stubClipboard(vi.fn(async () => Promise.reject(new Error('denied'))));
		const execCommand = vi.fn(() => true);
		Object.defineProperty(document, 'execCommand', {
			value: execCommand,
			configurable: true,
			writable: true,
		});

		const { result } = renderHook(() => useCopyToken(TOKEN));
		await act(async () => {
			await result.current.handleCopy();
		});

		expect(execCommand).toHaveBeenCalledWith('copy');
		// The scratch textarea is a temporary DOM node, not a leak.
		expect(document.querySelectorAll('textarea')).toHaveLength(0);
		await waitFor(() => expect(result.current.copied).toBe(true));
		expect(toastError).not.toHaveBeenCalled();
	});

	it('surfaces a toast when every copy strategy fails', async () => {
		stubClipboard(vi.fn(async () => Promise.reject(new Error('denied'))));
		// jsdom has no execCommand at all, so the fallback throws too — which
		// is exactly the "nothing worked" case the toast exists for.
		Reflect.deleteProperty(document, 'execCommand');

		const { result } = renderHook(() => useCopyToken(TOKEN));
		await act(async () => {
			await result.current.handleCopy();
		});

		expect(toastError).toHaveBeenCalledWith('tokenReveal.copyFailed');
		expect(result.current.copied).toBe(false);
		expect(document.querySelectorAll('textarea')).toHaveLength(0);
	});

	it('reset clears the copied flag so the token can be copied again', async () => {
		stubClipboard(vi.fn(async () => undefined));
		const { result } = renderHook(() => useCopyToken(TOKEN));

		await act(async () => {
			await result.current.handleCopy();
		});
		await waitFor(() => expect(result.current.copied).toBe(true));

		act(() => {
			result.current.reset();
		});

		expect(result.current.copied).toBe(false);
	});
});
