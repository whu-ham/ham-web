/**
 * @author Claude
 * @version 4.0
 * @date 2026/5/22
 *
 * Generic QR login view for the /login page.
 * Writes to `loginMeAtom` on success instead of calling a callback prop.
 *
 * QR login flow:
 *   1. POST /api/auth/qr/ticket → get ticket
 *   2. GET /api/auth/qr/ticket/:ticket → poll state
 *   3. On CONFIRMED → call /api/auth/me → setLoginMe(me)
 *
 * Visibility-aware polling (§4):
 *   - The poll interval is paused while `document.hidden` is true.
 *   - When the tab becomes visible again the component immediately fires one
 *     poll. If the ticket had expired while hidden it is automatically
 *     refreshed.
 */
'use client';

import { Avatar } from '@heroui/react';
import toast from 'react-hot-toast';
import { useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { loginMeAtom } from '@/app/login/store';
import {
	CheckTicketResponse,
	QR_TICKET_STATE,
	WebAuthApi,
} from '@/services/sso/api';

const POLL_INTERVAL_MS = 2000;

const isDocumentHidden = (): boolean => {
	return typeof document !== 'undefined' && document.hidden;
};

interface QRLoginViewProps {
	onLoginFailed?: () => void;
}

const QRLoginView = ({ onLoginFailed }: QRLoginViewProps) => {
	const t = useTranslations('sso.qr');
	const setLoginMe = useSetAtom(loginMeAtom);
	const [ticket, setTicket] = useState<string>('');
	const [check, setCheck] = useState<CheckTicketResponse | null>(null);
	const [creating, setCreating] = useState(false);
	const [createFailed, setCreateFailed] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const timerRef = useRef<number | null>(null);
	const creatingRef = useRef(false);
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
					window.setTimeout(async () => {
						try {
							const me = await WebAuthApi.me();
							setLoginMe(me);
						} catch {
							onLoginFailed?.();
						}
					}, 500);
				} else if (
					resp.state === QR_TICKET_STATE.EXPIRED ||
					resp.state === QR_TICKET_STATE.INVALID
				) {
					clearTimer();
				}
			} catch {
				// Network blip — keep polling
			}
		};

		pollRef.current = poll;

		if (!isDocumentHidden()) {
			poll();
		}

		if (!isDocumentHidden()) {
			timerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
		}

		return () => clearTimer();
	}, [ticket, clearTimer, setLoginMe, onLoginFailed, t]);

	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.hidden) {
				clearTimer();
				return;
			}

			const currentPoll = pollRef.current;
			if (!currentPoll) return;

			currentPoll().then(() => {
				if (timerRef.current === null) {
					setCheck((prev) => {
						const expiredOrInvalid =
							prev?.state === QR_TICKET_STATE.EXPIRED ||
							prev?.state === QR_TICKET_STATE.INVALID;
						if (expiredOrInvalid) {
							refresh();
						}
						return prev;
					});
				}
			});

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

			<div
				className={
					'h-[160px] flex items-center justify-center relative rounded-[12px]'
				}
			>
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
								'material-icons-round text-muted text-[40px]! leading-none!'
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

				{!createFailed && isConfirmed && (
					<div className={'flex flex-col items-center gap-2'}>
						<div
							className={
								'size-12 rounded-full bg-accent flex items-center justify-center'
							}
						>
							<span
								className={
									'material-icons-round text-accent-foreground text-3xl!'
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
								'material-icons-round text-muted text-[40px]! leading-none!'
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
