/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/22
 *
 * Custom hook for token list management.
 * Handles fetching, revoking, rotate modal, and create modal coordination.
 *
 * M3 fix: Uses tokenListVersionAtom as an event signal instead of
 * newlyCreatedTokenAtom. Fixes missing deps and double data source issues.
 */

'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

import {
	createModalVisibleAtom,
	rotateModalAtom,
	tokenListAtom,
	tokenListLoadingAtom,
	tokenListVersionAtom,
} from '@/app/console/tokens/store';
import type { TokenListItem } from '@/services/token/api';
import { TokenApi } from '@/services/token/api';

export interface UseTokenListReturn {
	tokens: TokenListItem[];
	loading: boolean;
	fetchTokens: () => Promise<void>;
	handleRevoke: (id: string) => Promise<void>;
	handleRotate: (id: string) => void;
	setCreateModalVisible: (visible: boolean) => void;
}

export const useTokenList = (
	initialTokens?: TokenListItem[]
): UseTokenListReturn => {
	const t = useTranslations('apikey');
	const [tokens, setTokens] = useAtom(tokenListAtom);
	const [loading, setLoading] = useAtom(tokenListLoadingAtom);
	const setCreateModalVisible = useSetAtom(createModalVisibleAtom);
	const setRotateModal = useSetAtom(rotateModalAtom);
	const tokenListVersion = useAtomValue(tokenListVersionAtom);

	const fetchTokens = useCallback(async () => {
		setLoading(true);
		try {
			const resp = await TokenApi.list();
			setTokens(resp.tokens);
		} catch {
			toast.error(t('error.fetchFailed'));
		} finally {
			setLoading(false);
		}
	}, [setTokens, setLoading, t]);

	// Hydrate from SSR data or fetch on mount
	useEffect(() => {
		if (!initialTokens || initialTokens.length === 0) {
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
		fetchTokens,
		handleRevoke,
		handleRotate,
		setCreateModalVisible,
	};
};
