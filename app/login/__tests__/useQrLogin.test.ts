/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:19:22
 *
 * Unit tests for useQrLogin — the polling loop behind the QR login tab.
 *
 * The hook is the only thing standing between the user and a dead QR code:
 * it has to notice every state transition (PENDING → SCANNED → CONFIRMED),
 * stop polling the moment the ticket is settled, survive a failed poll, and
 * hand the user a fresh ticket when the old one expired — including when it
 * expired while the tab was in the background. It also must not keep a
 * network loop running after the view is gone.
 *
 * These tests drive the hook with fake timers and assert observable state,
 * the calls made to the mocked BFF client, and — crucially — that the poll
 * count stops growing once a terminal state is reached.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { toastError, translate, createQrTicket, checkQrTicket } = vi.hoisted(
	() => ({
		toastError: vi.fn(),
		// A stable translator matters: useQrLogin puts `t` in the dependency
		// array of `refresh`, and `refresh` drives the effect that creates the
		// ticket. A new function on every render would re-run that effect
		// forever.
		translate: (key: string) => key,
		createQrTicket: vi.fn(),
		checkQrTicket: vi.fn(),
	})
);

vi.mock('next-intl', () => ({
	useTranslations: () => translate,
}));

vi.mock('react-hot-toast', () => ({
	default: { error: (...args: unknown[]) => toastError(...args) },
}));

// Only the network boundary is mocked; QR_TICKET_STATE stays real so the
// tests assert against the same constants the hook compares to.
vi.mock('@/services/sso/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/sso/api')>();
	return {
		...actual,
		WebAuthApi: { ...actual.WebAuthApi, createQrTicket, checkQrTicket },
	};
});

import { useQrLogin } from '@/app/login/useQrLogin';
import { QR_TICKET_STATE } from '@/services/sso/api';

const POLL_INTERVAL_MS = 2000;

let tabHidden = false;
Object.defineProperty(document, 'hidden', {
	configurable: true,
	get: () => tabHidden,
});

/** Lets the fake clock run `ms` ahead and settles every promise it wakes. */
const advance = async (ms: number) => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
};

/** Flips `document.hidden` and fires the event the hook listens for. */
const setHidden = (hidden: boolean) => {
	tabHidden = hidden;
	document.dispatchEvent(new Event('visibilitychange'));
};

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
};

describe('useQrLogin', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		tabHidden = false;
		toastError.mockReset();
		createQrTicket.mockReset();
		checkQrTicket.mockReset();
		createQrTicket.mockResolvedValue({
			ticket: 'ticket-1',
			expires_in: 300,
		});
		checkQrTicket.mockResolvedValue({ state: QR_TICKET_STATE.PENDING });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('mints a ticket on mount and reports it as pending', async () => {
		const { result } = renderHook(() => useQrLogin());

		// The ticket request is deferred to a timeout so it never blocks the
		// first paint, so there is nothing to render yet.
		expect(result.current.ticket).toBe('');

		act(() => {
			vi.advanceTimersByTime(0);
		});
		expect(result.current.creating).toBe(true);
		expect(result.current.refreshing).toBe(true);

		await advance(0);

		expect(result.current.ticket).toBe('ticket-1');
		expect(result.current.creating).toBe(false);
		expect(result.current.refreshing).toBe(false);
		expect(result.current.createFailed).toBe(false);
		expect(result.current.check).toEqual({ state: QR_TICKET_STATE.PENDING });
		expect(result.current.isScanned).toBe(false);
		expect(result.current.isConfirmed).toBe(false);
		expect(result.current.isExpired).toBe(false);
		expect(checkQrTicket).toHaveBeenCalledWith('ticket-1');
	});

	it('follows PENDING → SCANNED → CONFIRMED and stops polling', async () => {
		checkQrTicket
			.mockResolvedValueOnce({ state: QR_TICKET_STATE.PENDING })
			.mockResolvedValueOnce({
				state: QR_TICKET_STATE.SCANNED,
				scan_user_info: { nickname: 'ada' },
			})
			.mockResolvedValueOnce({
				state: QR_TICKET_STATE.CONFIRMED,
				user_info: { user_id: 'u-1' },
			});
		const onLoginSucceeded = vi.fn();
		const { result } = renderHook(() => useQrLogin(onLoginSucceeded));

		await advance(0);
		expect(result.current.isScanned).toBe(false);
		expect(onLoginSucceeded).not.toHaveBeenCalled();

		await advance(POLL_INTERVAL_MS);
		expect(result.current.isScanned).toBe(true);
		expect(result.current.check?.scan_user_info?.nickname).toBe('ada');
		expect(onLoginSucceeded).not.toHaveBeenCalled();

		await advance(POLL_INTERVAL_MS);
		expect(result.current.isConfirmed).toBe(true);
		expect(onLoginSucceeded).toHaveBeenCalledTimes(1);

		// A confirmed ticket is terminal: polling must stop, otherwise the
		// app keeps hitting the backend with a ticket that can never change.
		const settled = checkQrTicket.mock.calls.length;
		await advance(POLL_INTERVAL_MS * 3);
		expect(checkQrTicket.mock.calls.length).toBe(settled);
	});

	it('stops polling and flags the ticket when it expires', async () => {
		checkQrTicket.mockResolvedValue({ state: QR_TICKET_STATE.EXPIRED });
		const { result } = renderHook(() => useQrLogin());

		await advance(0);
		expect(result.current.isExpired).toBe(true);

		const settled = checkQrTicket.mock.calls.length;
		await advance(POLL_INTERVAL_MS * 3);
		expect(checkQrTicket.mock.calls.length).toBe(settled);
	});

	it('treats an invalidated ticket the same as an expired one', async () => {
		checkQrTicket.mockResolvedValue({ state: QR_TICKET_STATE.INVALID });
		const { result } = renderHook(() => useQrLogin());

		await advance(0);
		expect(result.current.isExpired).toBe(true);
		expect(result.current.isScanned).toBe(false);

		const settled = checkQrTicket.mock.calls.length;
		await advance(POLL_INTERVAL_MS * 3);
		expect(checkQrTicket.mock.calls.length).toBe(settled);
	});

	it('keeps polling after a failed check', async () => {
		checkQrTicket
			.mockRejectedValueOnce(new Error('network blip'))
			.mockResolvedValueOnce({ state: QR_TICKET_STATE.PENDING });
		const { result } = renderHook(() => useQrLogin());

		await advance(0);
		// A dropped poll must not look like an expired ticket.
		expect(result.current.check).toBeNull();
		expect(result.current.isExpired).toBe(false);

		await advance(POLL_INTERVAL_MS);
		expect(checkQrTicket).toHaveBeenCalledTimes(2);
		expect(result.current.check).toEqual({ state: QR_TICKET_STATE.PENDING });
	});

	it('reports a failed ticket creation and never starts polling', async () => {
		createQrTicket.mockRejectedValue(new Error('backend down'));
		const { result } = renderHook(() => useQrLogin());

		await advance(0);
		await advance(POLL_INTERVAL_MS * 3);

		expect(result.current.createFailed).toBe(true);
		expect(result.current.creating).toBe(false);
		expect(result.current.refreshing).toBe(false);
		expect(toastError).toHaveBeenCalledWith('createFailed');
		expect(result.current.ticket).toBe('');
		expect(checkQrTicket).not.toHaveBeenCalled();
	});

	it('refresh() clears the previous check and mints a new ticket', async () => {
		checkQrTicket.mockResolvedValue({ state: QR_TICKET_STATE.SCANNED });
		const { result } = renderHook(() => useQrLogin());

		await advance(0);
		expect(result.current.isScanned).toBe(true);

		createQrTicket.mockResolvedValue({
			ticket: 'ticket-2',
			expires_in: 300,
		});
		checkQrTicket.mockResolvedValue({ state: QR_TICKET_STATE.PENDING });

		await act(async () => {
			await result.current.refresh();
		});

		expect(createQrTicket).toHaveBeenCalledTimes(2);
		expect(result.current.ticket).toBe('ticket-2');
		expect(result.current.refreshing).toBe(false);
		expect(result.current.createFailed).toBe(false);
		expect(result.current.isScanned).toBe(false);
	});

	it('ignores a refresh that overlaps one already in flight', async () => {
		const { result } = renderHook(() => useQrLogin());
		await advance(0);

		await act(async () => {
			// The second call starts while the first is still awaiting, and
			// must be dropped instead of minting a second ticket.
			await Promise.all([result.current.refresh(), result.current.refresh()]);
		});

		expect(createQrTicket).toHaveBeenCalledTimes(2);
	});

	it('stops polling once the hook is unmounted', async () => {
		const { result, unmount } = renderHook(() => useQrLogin());

		await advance(0);
		await advance(POLL_INTERVAL_MS);
		const settled = checkQrTicket.mock.calls.length;
		expect(settled).toBe(2);

		unmount();
		await advance(POLL_INTERVAL_MS * 3);

		expect(checkQrTicket.mock.calls.length).toBe(settled);
		expect(result.current.ticket).toBe('ticket-1');
	});

	it('waits for a visible tab before polling a freshly minted ticket', async () => {
		tabHidden = true;
		const { result } = renderHook(() => useQrLogin());

		await advance(0);
		expect(result.current.ticket).toBe('ticket-1');
		expect(checkQrTicket).not.toHaveBeenCalled();

		setHidden(false);
		await advance(0);
		expect(checkQrTicket).toHaveBeenCalledTimes(1);

		// Coming back to the tab has to re-arm the interval, not just poll once.
		await advance(POLL_INTERVAL_MS);
		expect(checkQrTicket).toHaveBeenCalledTimes(2);
	});

	it('pauses polling while the tab is hidden and resumes on return', async () => {
		const { result } = renderHook(() => useQrLogin());
		await advance(0);

		setHidden(true);
		await advance(POLL_INTERVAL_MS * 3);
		const whileHidden = checkQrTicket.mock.calls.length;

		setHidden(false);
		await advance(0);
		expect(checkQrTicket.mock.calls.length).toBe(whileHidden + 1);

		await advance(POLL_INTERVAL_MS);
		expect(checkQrTicket.mock.calls.length).toBe(whileHidden + 2);
		expect(result.current.isExpired).toBe(false);
	});

	it('does not re-arm the poller while one is already running', async () => {
		const { result } = renderHook(() => useQrLogin());
		await advance(0);

		// A visibilitychange that arrives while the tab is already visible
		// must not leave two intervals behind.
		setHidden(false);
		await advance(0);
		expect(checkQrTicket).toHaveBeenCalledTimes(2);

		await advance(POLL_INTERVAL_MS);
		expect(checkQrTicket).toHaveBeenCalledTimes(3);
		expect(result.current.isExpired).toBe(false);
	});

	it('ignores a visibility change before a ticket exists', async () => {
		const { result } = renderHook(() => useQrLogin());

		act(() => {
			document.dispatchEvent(new Event('visibilitychange'));
		});
		expect(checkQrTicket).not.toHaveBeenCalled();

		await advance(0);
		expect(result.current.ticket).toBe('ticket-1');
		expect(checkQrTicket).toHaveBeenCalledTimes(1);
	});

	it('refreshes a ticket that expired while the tab was hidden', async () => {
		const { result } = renderHook(() => useQrLogin());
		await advance(0);

		setHidden(true);
		checkQrTicket.mockResolvedValue({ state: QR_TICKET_STATE.EXPIRED });
		createQrTicket.mockResolvedValue({
			ticket: 'ticket-2',
			expires_in: 300,
		});

		setHidden(false);
		await advance(0);

		expect(createQrTicket).toHaveBeenCalledTimes(2);
		expect(result.current.ticket).toBe('ticket-2');
	});

	it('refreshes a ticket the backend invalidated while hidden', async () => {
		const { result } = renderHook(() => useQrLogin());
		await advance(0);

		setHidden(true);
		checkQrTicket.mockResolvedValue({ state: QR_TICKET_STATE.INVALID });
		createQrTicket.mockResolvedValue({
			ticket: 'ticket-2',
			expires_in: 300,
		});

		setHidden(false);
		await advance(0);

		expect(createQrTicket).toHaveBeenCalledTimes(2);
		expect(result.current.ticket).toBe('ticket-2');
	});

	it('leaves the poller paused when the tab goes away mid-poll', async () => {
		const { result } = renderHook(() => useQrLogin());
		await advance(0);

		setHidden(true);
		const pending = deferred<{ state: string }>();
		checkQrTicket.mockImplementationOnce(() => pending.promise);

		setHidden(false);
		// The user switches away again while the resume poll is in flight.
		tabHidden = true;
		pending.resolve({ state: QR_TICKET_STATE.PENDING });
		await advance(0);

		expect(checkQrTicket).toHaveBeenCalledTimes(2);

		await advance(POLL_INTERVAL_MS * 3);
		expect(checkQrTicket).toHaveBeenCalledTimes(2);
		expect(result.current.isExpired).toBe(false);
	});
});
