/**
 * @author Claude
 * @version 3.0
 * @date 2026/5/22
 *
 * Modal for rotating an API token. Warns that the old key is immediately
 * revoked, and lets the user set a new TTL.
 */
'use client';

import { Button, Label, Modal, NumberField } from '@heroui/react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

import {
	newlyCreatedTokenAtom,
	rotateModalAtom,
} from '@/app/console/tokens/store';
import { ApiError, TokenApi } from '@/services/token/api';

const RotateTokenModal = () => {
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

	return (
		<Modal>
			<Modal.Backdrop
				isOpen={rotateModal.visible}
				onOpenChange={(open) => {
					if (!open) handleClose();
				}}
			>
				<Modal.Container>
					<Modal.Dialog>
						<Modal.Header>
							<Modal.Heading>{t('rotateModal.title')}</Modal.Heading>
							<Modal.CloseTrigger />
						</Modal.Header>
						<Modal.Body className={'flex flex-col gap-5 overflow-visible'}>
							<p className={'text-sm text-danger'}>
								{t('rotateModal.warning')}
							</p>
							<NumberField
								minValue={1}
								maxValue={30}
								value={ttl}
								onChange={(v) => setTtl(v ?? 30)}
								className={'w-full'}
								variant='secondary'
							>
								<Label>{t('rotateModal.ttl')}</Label>
								<NumberField.Group>
									<NumberField.DecrementButton />
									<NumberField.Input />
									<NumberField.IncrementButton />
								</NumberField.Group>
							</NumberField>
						</Modal.Body>
						<Modal.Footer>
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
			</Modal.Backdrop>
		</Modal>
	);
};

export default RotateTokenModal;
