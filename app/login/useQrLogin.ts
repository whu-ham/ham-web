/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Custom hook for QR login flow:
 *   1. POST /api/auth/qr/ticket → get ticket
 *   2. GET /api/auth/qr/ticket/:ticket → poll state
 *   3. On CONFIRMED → call /api/auth/me → setLoginMe(me)
 *
 * Visibility-aware polling:
 *   - The poll interval is paused while `document.hidden` is true.
 *   - When the tab becomes visible again the hook immediately fires one
 *     poll. If the ticket had expired while hidden it is automatically
 *     refreshed.
 */

'use client';

import toast from 'react-hot-toast';
import { useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
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

export interface UseQrLoginReturn {
	ticket: string;
	check: CheckTicketResponse | null;
	creating: boolean;
	createFailed: boolean;
	refreshing: boolean;
	refresh: () => Promise<void>;
	isExpired: boolean;
	isConfirmed: boolean;
	isScanned: boolean;
}

export const useQrLogin = (onLoginFailed?: () => void): UseQrLoginReturn => {
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

	return {
		ticket,
		check,
		creating,
		createFailed,
		refreshing,
		refresh,
		isExpired,
		isConfirmed,
		isScanned,
	};
};
