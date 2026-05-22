/**
 * @author Claude
 * @version 3.0
 * @date 2026/5/22
 *
 * Modal that reveals a newly created / rotated API token.
 * Rendering-only — copy logic in useCopyToken.
 */

'use client';

import {
	Button,
	Description,
	InputGroup,
	Label,
	Modal,
	TextField,
} from '@heroui/react';
import { useAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { newlyCreatedTokenAtom } from '@/app/console/tokens/store';
import { useCopyToken } from '@/app/console/tokens/useCopyToken';

const TokenRevealModal = () => {
	const t = useTranslations('apikey');
	const [newlyCreated, setNewlyCreated] = useAtom(newlyCreatedTokenAtom);
	const { copied, handleCopy, reset } = useCopyToken(newlyCreated?.raw_token);

	const handleClose = useCallback(() => {
		setNewlyCreated(null);
		reset();
	}, [setNewlyCreated, reset]);

	return (
		<Modal>
			<Modal.Backdrop
				isOpen={!!newlyCreated}
				onOpenChange={(open) => {
					if (!open) handleClose();
				}}
			>
				<Modal.Container>
					<Modal.Dialog>
						<Modal.Header>
							<Modal.Heading>{t('tokenReveal.title')}</Modal.Heading>
							<Modal.CloseTrigger />
						</Modal.Header>
						<Modal.Body className={'flex flex-col gap-4 overflow-visible'}>
							<TextField className={'w-full'}>
								<Label>{t('tokenReveal.label')}</Label>
								<InputGroup variant='secondary'>
									<InputGroup.Input
										className={'w-full font-mono text-sm select-all'}
										value={newlyCreated?.raw_token ?? ''}
										readOnly
									/>
									<InputGroup.Suffix className={'pr-0'}>
										<Button
											isIconOnly
											aria-label={t('tokenReveal.copy')}
											size={'sm'}
											variant={'ghost'}
											onPress={handleCopy}
											isDisabled={copied}
										>
											<span
												className={
													'material-icons-round text-[18px]! leading-none!'
												}
												aria-hidden={true}
											>
												{copied ? 'check' : 'content_copy'}
											</span>
										</Button>
									</InputGroup.Suffix>
								</InputGroup>
								<Description>{t('tokenReveal.warning')}</Description>
							</TextField>
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
};

export default TokenRevealModal;
