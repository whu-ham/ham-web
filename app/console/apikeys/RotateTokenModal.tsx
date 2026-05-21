/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * Modal for rotating an API token. Warns that the old key is immediately
 * revoked, and lets the user set a new TTL.
 */
'use client';

import { Alert, Button, Modal, Slider, useOverlayState } from '@heroui/react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

import {
	newlyCreatedTokenAtom,
	rotateModalAtom,
} from '@/app/console/apikeys/store';
import { ApiError, TokenApi } from '@/services/token/api';

const RotateTokenModal = () => {
	const t = useTranslations('apikey');
	const tc = useTranslations('common');
	const [rotateModal, setRotateModal] = useAtom(rotateModalAtom);
	const setNewlyCreated = useSetAtom(newlyCreatedTokenAtom);
	const [ttl, setTtl] = useState(30);
	const [submitting, setSubmitting] = useState(false);

	const handleClose = useCallback(() => {
		setRotateModal({ visible: false, tokenId: null });
		setTtl(30);
	}, [setRotateModal]);

	const state = useOverlayState({
		isOpen: rotateModal.visible,
		onOpenChange: (open) => {
			if (!open) handleClose();
		},
	});

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

	return (
		<Modal state={state}>
			<Modal.Backdrop />
			<Modal.Container>
				<Modal.Dialog>
					<Modal.Header>
						<Modal.Heading>{t('rotateModal.title')}</Modal.Heading>
						<Modal.CloseTrigger />
					</Modal.Header>
					<Modal.Body className={'flex flex-col gap-4'}>
						<Alert variant={'danger'}>
							{t('rotateModal.warning')}
						</Alert>
						<Slider
							label={t('rotateModal.ttl')}
							minValue={1}
							maxValue={30}
							value={ttl}
							onChange={(v) => setTtl(v as number)}
						/>
					</Modal.Body>
					<Modal.Footer>
						<Modal.CloseTrigger>
							<Button variant={'tertiary'}>{tc('cancel')}</Button>
						</Modal.CloseTrigger>
						<Button
							variant={'primary'}
							isPending={submitting}
							onPress={handleSubmit}
						>
							{t('rotateModal.submit')}
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal>
	);
};

export default RotateTokenModal;
