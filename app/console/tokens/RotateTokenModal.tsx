/**
 * @author Claude
 * @version 4.0
 * @date 2026/5/22
 *
 * Modal for rotating an API token.
 * Rendering-only — all logic in useRotateToken.
 */

'use client';

import { Button, Label, Modal, NumberField } from '@heroui/react';
import { useTranslations } from 'next-intl';

import { useRotateToken } from '@/app/console/tokens/useRotateToken';

const RotateTokenModal = () => {
	const t = useTranslations('apikey');
	const { rotateModal, ttl, setTtl, submitting, handleClose, handleSubmit } =
		useRotateToken();

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
