/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * Modal for rotating an API token. Warns that the old key is immediately
 * revoked, and lets the user set a new TTL.
 */
'use client';

import {
	Alert,
	Button,
	Label,
	Modal,
	Slider,
} from '@heroui/react';
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
	const tc = useTranslations('common');
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
			<Modal.Backdrop isOpen={rotateModal.visible} onOpenChange={(open) => { if (!open) handleClose(); }}>
				<Modal.Container>
					<Modal.Dialog>
					<Modal.Header>
						<Modal.Heading>{t('rotateModal.title')}</Modal.Heading>
						<Modal.CloseTrigger />
					</Modal.Header>
					<Modal.Body className={'flex flex-col gap-4'}>
						<Alert status={'danger'}>
							<Alert.Indicator />
							<Alert.Content>
								<Alert.Description>
									{t('rotateModal.warning')}
								</Alert.Description>
							</Alert.Content>
						</Alert>
						<Slider
							minValue={1}
							maxValue={30}
							value={ttl}
							onChange={(v) => setTtl(v as number)}
						>
							<Label>{t('rotateModal.ttl')}</Label>
							<Slider.Output />
							<Slider.Track>
								<Slider.Fill />
								<Slider.Thumb />
							</Slider.Track>
						</Slider>
					</Modal.Body>
					<Modal.Footer>
						<Button slot="close" variant={'tertiary'}>
							{tc('cancel')}
						</Button>
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
