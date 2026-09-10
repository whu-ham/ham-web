/**
 * Custom hook for QR login flow:
 *   1. POST /api/auth/qr/ticket → get ticket
 *   2. GET /api/auth/qr/ticket/:ticket → poll state
 *   3. On CONFIRMED → session cookie is set by backend → call onLoginSucceeded()
 *
 * Visibility-aware polling:
 *   - The poll interval is paused while `document.hidden` is true.
 *   - When the tab becomes visible again the hook immediately fires one
 *     poll. If the ticket had expired while hidden it is automatically
 *     refreshed.
 */

'use client';

import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
	CheckTicketResponse,
	QR_TICKET_STATE,
	WebAuthApi,
} from '@/services/sso/api';

const POLL_INTERVAL_MS = 2000;

interface PollEntry {
	ticket: string;
	poll: () => Promise<void>;
}

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

export const useQrLogin = (onLoginSucceeded?: () => void): UseQrLoginReturn => {
	const t = useTranslations('sso.qr');
	const [ticket, setTicket] = useState<string>('');
	const [check, setCheck] = useState<CheckTicketResponse | null>(null);
	const [creating, setCreating] = useState(false);
	const [createFailed, setCreateFailed] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const timerRef = useRef<number | null>(null);
	const creatingRef = useRef(false);
	const pollRef = useRef<PollEntry | null>(null);
	const lastCheckRef = useRef<CheckTicketResponse | null>(null);

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
		lastCheckRef.current = null;
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
		const start = () => {
			void refresh();
		};

		const timer = window.setTimeout(start, 0);

		const onVisibilityChange = () => {
			if (document.hidden) {
				clearTimer();
				return;
			}

			const entry = pollRef.current;
			if (!entry) return;

			entry.poll().then(() => {
				if (timerRef.current !== null) return;

				const last = lastCheckRef.current;
				if (
					last &&
					(last.state === QR_TICKET_STATE.EXPIRED ||
						last.state === QR_TICKET_STATE.INVALID)
				) {
					refresh();
					return;
				}

				if (!document.hidden) {
					clearTimer();
					timerRef.current = window.setInterval(entry.poll, POLL_INTERVAL_MS);
				}
			});
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			window.clearTimeout(timer);
			clearTimer();
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, [refresh, clearTimer]);

	useEffect(() => {
		if (!ticket) return;

		clearTimer();

		const poll = async () => {
			try {
				const resp = await WebAuthApi.checkQrTicket(ticket);
				lastCheckRef.current = resp;
				setCheck(resp);

				if (resp.state === QR_TICKET_STATE.CONFIRMED) {
					clearTimer();
					// Session cookie is already set by backend — just signal success
					onLoginSucceeded?.();
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

		pollRef.current = { ticket, poll };

		if (!document.hidden) {
			poll();
			timerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
		}
	}, [ticket, clearTimer, onLoginSucceeded]);

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
