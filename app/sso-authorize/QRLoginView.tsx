/**
 * @author Claude
 * @version 2.2
 * @date 2026/4/21 17:06:46
 *
 * QR login view backed by the new HTTP endpoints. Differs from the legacy
 * `LoginQRCode` component (gRPC/WASM) in three important ways:
 *   1. `POST /web/auth/qr/ticket` / `GET /web/auth/qr/ticket/:ticket`
 *      are called via plain `fetch` with `credentials: 'include'` so the
 *      HttpOnly session cookies land correctly.
 *   2. When the backend reports EXPIRED / INVALID the QR code is hidden
 *      and a "refresh" button is shown, per requirement §2.6a / §2.6b.
 *   3. No token is stored in JS state — the backend delivers tokens via
 *      Set-Cookie on CONFIRMED and we immediately hand off to the
 *      consent flow by writing to `stageAtom`.
 *
 * Visibility-aware polling (§4):
 *   - The poll interval is paused while `document.hidden` is true to avoid
 *     wasting network requests when the tab is backgrounded.
 *   - When the tab becomes visible again the component immediately fires one
 *     poll. If the ticket had expired while hidden it is automatically
 *     refreshed so the user never sees a stale QR code.
 *
 * On login success, re-probes /me and writes `{ kind: 'consent', me }`
 * to `stageAtom` directly — no onLoggedIn prop needed.
 */
'use client';

import { Avatar } from '@heroui/react';
import toast from 'react-hot-toast';
import { useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
	CheckTicketResponse,
	QR_TICKET_STATE,
	WebAuthApi,
} from '@/services/sso/api';
import { stageAtom } from '@/app/sso-authorize/store';

const POLL_INTERVAL_MS = 2000;

/**
 * Returns true when the Page Visibility API reports the tab as hidden.
 * Falls back to false in environments where the API is unavailable (SSR).
 */
function isDocumentHidden(): boolean {
	return typeof document !== 'undefined' && document.hidden;
}

const QRLoginView = () => {
	const t = useTranslations('sso.qr');
	const setStage = useSetAtom(stageAtom);
	const [ticket, setTicket] = useState<string>('');
	const [check, setCheck] = useState<CheckTicketResponse | null>(null);
	const [creating, setCreating] = useState(false);
	const [createFailed, setCreateFailed] = useState(false);
	// Track whether a refresh is in-flight so we can show a spinner
	// instead of the white QR box (which would flash blank during the
	// async createQrTicket call).
	const [refreshing, setRefreshing] = useState(false);
	const timerRef = useRef<number | null>(null);
	// Guard against StrictMode double-invoke and concurrent calls
	const creatingRef = useRef(false);
	// Tracks the latest poll function so the visibility handler always
	// calls the current closure without needing to be re-registered.
	const pollRef = useRef<(() => Promise<void>) | null>(null);

	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const refresh = useCallback(async () => {
		if (creatingRef.current) return;
		creatingRef.current = true;
		setCreating(true);
		setRefreshing(true);
		setCheck(null);
		setCreateFailed(false);
		try {
			const resp = await WebAuthApi.createQrTicket();
			setTicket(resp.ticket);
		} catch {
			setCreateFailed(true);
			toast.error(t('createFailed'));
		} finally {
			creatingRef.current = false;
			setCreating(false);
			setRefreshing(false);
		}
	}, [t]);

	useEffect(() => {
		refresh();
		return () => clearTimer();
	}, [refresh, clearTimer]);

	useEffect(() => {
		if (!ticket) {
			return;
		}
		clearTimer();

		const poll = async () => {
			try {
				const resp = await WebAuthApi.checkQrTicket(ticket);
				setCheck(resp);

				if (resp.state === QR_TICKET_STATE.CONFIRMED) {
					clearTimer();
					// Brief pause so the user sees the "login success"
					// flash before the consent page takes over.
					window.setTimeout(async () => {
						try {
							const me = await WebAuthApi.me();
							setStage({ kind: 'consent', me });
						} catch {
							setStage({ kind: 'login' });
						}
					}, 500);
				} else if (
					resp.state === QR_TICKET_STATE.EXPIRED ||
					resp.state === QR_TICKET_STATE.INVALID
				) {
					clearTimer();
				}
			} catch {
				// Network blip — keep polling; errors are visible via toast
				// only if they keep happening, which we avoid spamming here.
			}
		};

		// Keep a stable ref so the visibility handler can always reach the
		// latest poll closure without being re-registered on every render.
		pollRef.current = poll;

		// Fire immediately so the first render isn't stuck on PENDING
		// visually until the first interval tick lands.
		if (!isDocumentHidden()) {
			poll();
		}

		// Only start the interval when the tab is currently visible.
		if (!isDocumentHidden()) {
			timerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
		}

		return () => clearTimer();
	}, [ticket, clearTimer, setStage]);

	// Visibility-aware polling: pause when hidden, resume on show.
	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.hidden) {
				// Tab went to background — stop polling to save resources.
				clearTimer();
				return;
			}

			// Tab became visible again.
			const currentPoll = pollRef.current;
			if (!currentPoll) return;

			// Immediately check the ticket state. If it expired while hidden
			// the poll will detect EXPIRED/INVALID and stop; the auto-refresh
			// below will then issue a new ticket so the user never sees a
			// stale QR code.
			currentPoll().then(() => {
				// After the immediate check, restart the interval only if the
				// ticket is still active (poll clears timerRef on terminal
				// states, so we check whether it was cleared).
				if (timerRef.current === null) {
					// Ticket expired or confirmed while hidden — trigger an
					// auto-refresh so the user gets a fresh QR code without
					// having to tap the refresh button manually.
					// We read the latest check state via the setter's
					// functional form to avoid a stale closure.
					setCheck((prev) => {
						const expiredOrInvalid =
							prev?.state === QR_TICKET_STATE.EXPIRED ||
							prev?.state === QR_TICKET_STATE.INVALID;
						if (expiredOrInvalid) {
							// Kick off a new ticket asynchronously.
							refresh();
						}
						// Return unchanged — we only used the setter to read
						// the latest state without an extra useState.
						return prev;
					});
				} else {
					// Ticket still active — interval was already restarted
					// inside poll(); nothing more to do.
				}
			});

			// Restart the interval for ongoing polling while visible.
			clearTimer();
			timerRef.current = window.setInterval(currentPoll, POLL_INTERVAL_MS);
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, [clearTimer, refresh]);

	const state = check?.state ?? QR_TICKET_STATE.PENDING;
	const isExpired =
		state === QR_TICKET_STATE.EXPIRED || state === QR_TICKET_STATE.INVALID;
	const isConfirmed = state === QR_TICKET_STATE.CONFIRMED;
	const isScanned = state === QR_TICKET_STATE.SCANNED;

	return (
		<div className={'flex flex-col items-center gap-4'}>
			<div className={'text-sm text-muted'}>{t('tip')}</div>

			{/* Fixed-height wrapper keeps card height stable across all states */}
			<div
				className={
					'h-[160px] flex items-center justify-center relative rounded-[12px]'
				}
			>
				{/* Create failed: gray refresh button, no white bg */}
				{createFailed && (
					<button
						type={'button'}
						onClick={refresh}
						disabled={creating}
						aria-label={t('refresh')}
						className={
							'flex flex-col items-center justify-center gap-2 size-[160px] rounded-[12px] bg-default hover:bg-default-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors'
						}
					>
						<span
							className={
								'material-icons-round text-muted !text-[40px] !leading-none'
							}
							aria-hidden={true}
						>
							refresh
						</span>
						<span className={'text-xs text-muted'}>{t('refresh')}</span>
					</button>
				)}

				{/* White QR box — hidden during refresh to avoid blank-white flash */}
				{!createFailed &&
					!isExpired &&
					!isConfirmed &&
					!isScanned &&
					!refreshing && (
						<div
							className={
								'size-[160px] flex items-center justify-center rounded-[12px] bg-white border border-border'
							}
						>
							{ticket && (
								<QRCodeSVG
									value={`ham://qrcode-login?ticket=${ticket}`}
									size={144}
								/>
							)}
						</div>
					)}

				{/* Scanned: hide QR, show avatar + label centered */}
				{!createFailed && isScanned && (
					<div className={'flex flex-col items-center gap-2'}>
						<Avatar>
							{check?.scan_user_info?.avatar_url ? (
								<Avatar.Image
									src={check.scan_user_info.avatar_url}
									alt={check.scan_user_info.nickname ?? ''}
								/>
							) : null}
							<Avatar.Fallback>
								{(check?.scan_user_info?.nickname ?? '?').slice(0, 1)}
							</Avatar.Fallback>
						</Avatar>
						<div
							className={
								'max-w-[140px] text-center text-sm font-semibold truncate'
							}
						>
							{check?.scan_user_info?.nickname ?? ''}
						</div>
						<div className={'text-xs text-muted text-center'}>
							{t('scanned')}
						</div>
					</div>
				)}

				{/* Confirmed: hide QR, show success icon + label centered */}
				{!createFailed && isConfirmed && (
					<div className={'flex flex-col items-center gap-2'}>
						<div
							className={
								'size-12 rounded-full bg-accent flex items-center justify-center'
							}
						>
							<span
								className={
									'material-icons-round text-accent-foreground !text-3xl'
								}
							>
								done
							</span>
						</div>
						<div className={'text-sm text-foreground text-center'}>
							{t('loginSuccess')}
						</div>
					</div>
				)}

				{/* Expired: hide QR, show refresh button + reason centered (no white bg) */}
				{!createFailed && isExpired && (
					<button
						type={'button'}
						onClick={refresh}
						disabled={creating}
						aria-label={t('refresh')}
						className={
							'flex flex-col items-center justify-center gap-2 size-[160px] rounded-[12px] bg-default hover:bg-default-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors'
						}
					>
						<span
							className={
								'material-icons-round text-muted !text-[40px] !leading-none'
							}
							aria-hidden={true}
						>
							refresh
						</span>
						<span className={'text-xs text-muted'}>{t('expired')}</span>
					</button>
				)}
			</div>
		</div>
	);
};

export default QRLoginView;
