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
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import {
	newlyCreatedTokenAtom,
	rotateModalAtom,
	tokenListVersionAtom,
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
	const bumpVersion = useSetAtom(tokenListVersionAtom);
	const [ttl, setTtl] = useState(30);
	const [submitting, setSubmitting] = useState(false);
	const submittingRef = useRef(false);
	const cancelledRef = useRef(false);

	// s5: Clean up on unmount
	useEffect(() => {
		return () => {
			cancelledRef.current = true;
		};
	}, []);

	const handleClose = useCallback(() => {
		setRotateModal({ visible: false, tokenId: null });
		setTtl(30);
	}, [setRotateModal]);

	const handleSubmit = useCallback(async () => {
		if (!rotateModal.tokenId) return;
		if (submittingRef.current) return; // M8: Prevent double submit

		submittingRef.current = true;
		setSubmitting(true);
		try {
			const resp = await TokenApi.rotate(rotateModal.tokenId, {
				ttl_days: ttl,
			});
			if (cancelledRef.current) return;
			setNewlyCreated(resp);
			bumpVersion((v) => v + 1);
			toast.success(t('rotateModal.success'));
			handleClose();
		} catch (e) {
			if (cancelledRef.current) return;
			if (e instanceof ApiError) {
				toast.error(e.message || t('error.rotateFailed'));
			} else {
				toast.error(t('error.rotateFailed'));
			}
		} finally {
			if (!cancelledRef.current) {
				submittingRef.current = false;
				setSubmitting(false);
			}
		}
	}, [rotateModal.tokenId, ttl, setNewlyCreated, handleClose, t, bumpVersion]);

	return {
		rotateModal,
		ttl,
		setTtl,
		submitting,
		handleClose,
		handleSubmit,
	};
};
