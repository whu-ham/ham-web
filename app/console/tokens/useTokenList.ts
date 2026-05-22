/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Custom hook for token list management.
 * Handles fetching, revoking, rotate modal, and create modal coordination.
 */

'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import {
	createModalVisibleAtom,
	newlyCreatedTokenAtom,
	rotateModalAtom,
	tokenListAtom,
	tokenListLoadingAtom,
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
	const newlyCreated = useAtomValue(newlyCreatedTokenAtom);
	const [hydrated, setHydrated] = useState(false);

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

	useEffect(() => {
		if (!initialTokens) {
			fetchTokens();
		}
		setHydrated(true);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (hydrated && newlyCreated) {
			fetchTokens();
		}
	}, [newlyCreated, fetchTokens, hydrated]);

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
