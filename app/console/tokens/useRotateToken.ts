/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Custom hook for the rotate token modal.
 * Handles TTL state, submission, and modal close.
 */

'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

import {
	newlyCreatedTokenAtom,
	rotateModalAtom,
} from '@/app/console/tokens/store';
import { ApiError, TokenApi } from '@/services/token/api';

export interface UseRotateTokenReturn {
	rotateModal: { visible: boolean; tokenId: string | null };
	ttl: number;
	setTtl: (ttl: number) => void;
	submitting: boolean;
	handleClose: () => void;
	handleSubmit: () => Promise<void>;
}

export const useRotateToken = (): UseRotateTokenReturn => {
	const t = useTranslations('apikey');
	const [rotateModal, setRotateModal] = useAtom(rotateModalAtom);
	const setNewlyCreated = useSetAtom(newlyCreatedTokenAtom);
	const [ttl, setTtl] = useState(30);
	const [submitting, setSubmitting] = useState(false);

	const handleClose = useCallback(() => {
		setRotateModal({ visible: false, tokenId: null });
		setTtl(30);
	}, [setRotateModal]);

	const handleSubmit = useCallback(async () => {
		if (!rotateModal.tokenId) return;

		setSubmitting(true);
		try {
			const resp = await TokenApi.rotate(rotateModal.tokenId, {
				ttl_days: ttl,
			});
			setNewlyCreated(resp);
			toast.success(t('rotateModal.success'));
			handleClose();
		} catch (e) {
			if (e instanceof ApiError) {
				toast.error(e.message || t('error.rotateFailed'));
			} else {
				toast.error(t('error.rotateFailed'));
			}
		} finally {
			setSubmitting(false);
		}
	}, [rotateModal.tokenId, ttl, setNewlyCreated, handleClose, t]);

	return {
		rotateModal,
		ttl,
		setTtl,
		submitting,
		handleClose,
		handleSubmit,
	};
};
