/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/20
 *
 * QR login tab backed by the new HTTP endpoints. Differs from the legacy
 * `LoginQRCode` component (gRPC/WASM) in three important ways:
 *   1. `POST /web/auth/qr/ticket` / `GET /web/auth/qr/ticket/:ticket`
 *      are called via plain `fetch` with `credentials: 'include'` so the
 *      HttpOnly session cookies land correctly.
 *   2. When the backend reports EXPIRED / INVALID the QR code is hidden
 *      and a "refresh" button is shown, per requirement §2.6a / §2.6b.
 *   3. No token is stored in JS state — the backend delivers tokens via
 *      Set-Cookie on CONFIRMED and we immediately hand off to the
 *      consent flow by calling `onLoggedIn`.
 */
'use client';

import { Avatar, Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import {
	CheckTicketResponse,
	QR_TICKET_STATE,
	WebAuthApi,
} from '@/services/sso/api';

const POLL_INTERVAL_MS = 2000;

// Stable toast id so repeated create-ticket failures (including the
// extra mount that React Strict Mode triggers in dev) collapse into
// a single on-screen toast instead of stacking.
const CREATE_FAILED_TOAST_ID = 'sso-qr-create-failed';

interface QRLoginTabProps {
	onLoggedIn: () => void;
}

const QRLoginTab = ({ onLoggedIn }: QRLoginTabProps) => {
	const t = useTranslations('sso.qr');
	const [ticket, setTicket] = useState<string>('');
	const [check, setCheck] = useState<CheckTicketResponse | null>(null);
	const [creating, setCreating] = useState(false);
	const [createFailed, setCreateFailed] = useState(false);
	const timerRef = useRef<number | null>(null);

	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const refresh = useCallback(async () => {
		setCreating(true);
		setCheck(null);
		setCreateFailed(false);
		try {
			const resp = await WebAuthApi.createQrTicket();
			setTicket(resp.ticket);
		} catch {
			setCreateFailed(true);
			// `id` dedupes the toast: react-hot-toast treats two toasts
			// with the same id as one, so Strict Mode's double-invoke
			// can't stack a second copy on top.
			toast.error(t('createFailed'), { id: CREATE_FAILED_TOAST_ID });
		} finally {
			setCreating(false);
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
					window.setTimeout(onLoggedIn, 500);
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
		// Fire immediately so the first render isn't stuck on PENDING
		// visually until the first interval tick lands.
		poll();
		timerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
		return () => clearTimer();
	}, [ticket, clearTimer, onLoggedIn]);

	const state = check?.state ?? QR_TICKET_STATE.PENDING;
	const isExpired =
		state === QR_TICKET_STATE.EXPIRED || state === QR_TICKET_STATE.INVALID;
	const isConfirmed = state === QR_TICKET_STATE.CONFIRMED;
	const isScanned = state === QR_TICKET_STATE.SCANNED;

	return (
		<div className={'flex flex-col items-center gap-4'}>
			<div className={'text-sm text-muted'}>{t('tip')}</div>

			<div
				className={
					'size-[160px] flex items-center justify-center relative rounded-[12px] bg-surface border border-border'
				}
			>
				{createFailed && (
					// Placeholder shown when ticket creation failed. The
					// whole tile is clickable so the user can retry without
					// hunting for a tiny button — the material `refresh`
					// glyph doubles as the affordance.
					<button
						type={'button'}
						onClick={refresh}
						disabled={creating}
						aria-label={t('refresh')}
						className={
							'flex flex-col items-center justify-center gap-2 size-full rounded-[12px] bg-default hover:bg-default-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors'
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

				{!createFailed &&
					!isExpired &&
					!isConfirmed &&
					!isScanned &&
					ticket && (
						<QRCodeSVG
							value={`ham://qrcode-login?ticket=${ticket}`}
							size={144}
						/>
					)}

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
						<div className={'text-xs text-muted'}>{t('scanned')}</div>
					</div>
				)}

				{!createFailed && isExpired && (
					<div className={'flex flex-col items-center gap-2 px-2 text-center'}>
						<div className={'text-3xl'}>⌛</div>
						<div className={'text-sm text-foreground'}>{t('expired')}</div>
						<Button
							size={'sm'}
							variant={'primary'}
							isPending={creating}
							onPress={() => refresh()}
						>
							{t('refresh')}
						</Button>
					</div>
				)}

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
						<div className={'text-sm text-foreground'}>{t('loginSuccess')}</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default QRLoginTab;
