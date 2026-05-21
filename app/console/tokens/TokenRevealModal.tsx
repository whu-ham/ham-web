/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * Modal that reveals a newly created / rotated API token.
 * Shows the raw token value once with a copy button and a warning
 * that it won't be shown again.
 */
'use client';

import { Alert, Button, Modal } from '@heroui/react';
import { useAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

import { newlyCreatedTokenAtom } from '@/app/console/tokens/store';

const TokenRevealModal = () => {
	const t = useTranslations('apikey');
	const [newlyCreated, setNewlyCreated] = useAtom(newlyCreatedTokenAtom);
	const [copied, setCopied] = useState(false);

	const handleClose = useCallback(() => {
		setNewlyCreated(null);
		setCopied(false);
	}, [setNewlyCreated]);

	const handleCopy = useCallback(async () => {
		if (!newlyCreated?.token) return;
		try {
			await navigator.clipboard.writeText(newlyCreated.token);
			setCopied(true);
		} catch {
			const textarea = document.createElement('textarea');
			textarea.value = newlyCreated.token;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			setCopied(true);
		}
	}, [newlyCreated]);

	return (
		<Modal>
			<Modal.Backdrop isOpen={!!newlyCreated} onOpenChange={(open) => { if (!open) handleClose(); }}>
				<Modal.Container>
					<Modal.Dialog>
						<Modal.Header>
							<Modal.Heading>{t('tokenReveal.title')}</Modal.Heading>
						</Modal.Header>
					<Modal.Body className={'flex flex-col gap-4'}>
						<Alert status={'warning'}>
							<Alert.Indicator />
							<Alert.Content>
								<Alert.Description>
									{t('tokenReveal.warning')}
								</Alert.Description>
							</Alert.Content>
						</Alert>
						<div
							className={
								'bg-default rounded-[8px] p-3 font-mono text-sm break-all select-all'
							}
						>
							{newlyCreated?.token}
						</div>
					</Modal.Body>
					<Modal.Footer>
						<Button
							variant={'primary'}
							onPress={handleCopy}
							isDisabled={copied}
						>
							{copied ? t('tokenReveal.copied') : t('tokenReveal.copy')}
						</Button>
						<Button slot="close" variant={'tertiary'}>
							{t('tokenReveal.close')}
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
		</Modal>
	);
};

export default TokenRevealModal;
