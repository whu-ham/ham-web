/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/22
 *
 * Custom hook for token list management.
 * Handles fetching, revoking, rotate modal, and create modal coordination.
 *
 * M3 fix: Uses tokenListVersionAtom as an event signal instead of
 * newlyCreatedTokenAtom. Fixes missing deps and double data source issues.
 *
 * M2 fix: Adds cancelledRef and request version counter to prevent
 * stale responses and loading state getting stuck on unmount.
 */
'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

import {
	createModalVisibleAtom,
	rotateModalAtom,
	tokenListAtom,
	tokenListErrorAtom,
	tokenListLoadingAtom,
	tokenListVersionAtom,
} from '@/app/console/tokens/store';
import type { TokenListItem } from '@/services/token/api';
import { TokenApi } from '@/services/token/api';

export interface UseTokenListReturn {
	tokens: TokenListItem[];
	loading: boolean;
	fetchError: boolean;
	fetchTokens: () => Promise<void>;
	handleRevoke: (id: string) => Promise<void>;
	handleRotate: (id: string) => void;
	setCreateModalVisible: (visible: boolean) => void;
}

export const useTokenList = (
	initialTokens?: TokenListItem[] | null
): UseTokenListReturn => {
	const t = useTranslations('apikey');
	const [tokens, setTokens] = useAtom(tokenListAtom);
	const [loading, setLoading] = useAtom(tokenListLoadingAtom);
	const [fetchError, setFetchError] = useAtom(tokenListErrorAtom);
	const setCreateModalVisible = useSetAtom(createModalVisibleAtom);
	const setRotateModal = useSetAtom(rotateModalAtom);
	const tokenListVersion = useAtomValue(tokenListVersionAtom);

	// M2: Request version counter to discard stale responses
	const reqIdRef = useRef(0);
	// M2: Cancel guard for unmount
	const cancelledRef = useRef(false);

	useEffect(() => {
		return () => {
			cancelledRef.current = true;
		};
	}, []);

	const fetchTokens = useCallback(async () => {
		const myId = ++reqIdRef.current;
		setLoading(true);
		setFetchError(false);
		try {
			const resp = await TokenApi.list();
			if (cancelledRef.current || myId !== reqIdRef.current) return;
			setTokens(resp.tokens);
		} catch {
			if (cancelledRef.current || myId !== reqIdRef.current) return;
			toast.error(t('error.fetchFailed'));
			setFetchError(true);
		} finally {
			if (!cancelledRef.current && myId === reqIdRef.current) {
				setLoading(false);
			}
		}
	}, [setTokens, setLoading, setFetchError, t]);

	// Hydrate from SSR data or fetch on mount
	useEffect(() => {
		if (!initialTokens) {
			fetchTokens();
		}
	}, [initialTokens, fetchTokens]);

	// Refetch when version changes (create/rotate success)
	useEffect(() => {
		if (tokenListVersion > 0) {
			fetchTokens();
		}
	}, [tokenListVersion, fetchTokens]);

	const handleRevoke = useCallback(
		async (id: string) => {
			try {
				await TokenApi.revoke(id);
				setTokens((prev) => prev.filter((tk) => tk.id !== id));
			} catch {
				toast.error(t('error.revokeFailed'));
			}
		},
		[setTokens, t]
	);

	const handleRotate = useCallback(
		(id: string) => {
			setRotateModal({ visible: true, tokenId: id });
		},
		[setRotateModal]
	);

	return {
		tokens,
		loading,
		fetchError,
		fetchTokens,
		handleRevoke,
		handleRotate,
		setCreateModalVisible,
	};
};
