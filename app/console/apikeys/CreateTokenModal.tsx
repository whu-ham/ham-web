/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * Modal for creating a new API token with name, scopes, and TTL.
 */
'use client';

import {
	Button,
	Checkbox,
	CheckboxGroup,
	Input,
	Label,
	Modal,
	Slider,
	TextField,
	useOverlayState,
} from '@heroui/react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

import {
	createModalVisibleAtom,
	newlyCreatedTokenAtom,
} from '@/app/console/apikeys/store';
import { ApiError, TokenApi, VALID_SCOPES } from '@/services/token/api';

const CreateTokenModal = () => {
	const t = useTranslations('apikey');
	const tc = useTranslations('common');
	const [visible, setVisible] = useAtom(createModalVisibleAtom);
	const setNewlyCreated = useSetAtom(newlyCreatedTokenAtom);
	const [name, setName] = useState('');
	const [scopes, setScopes] = useState<string[]>([]);
	const [ttl, setTtl] = useState(30);
	const [submitting, setSubmitting] = useState(false);

	const handleClose = useCallback(() => {
		setVisible(false);
		setName('');
		setScopes([]);
		setTtl(30);
	}, [setVisible]);

	const state = useOverlayState({
		isOpen: visible,
		onOpenChange: (open) => {
			if (!open) handleClose();
		},
	});

	const handleSubmit = useCallback(async () => {
		if (!name.trim()) {
			toast.error(t('validation.nameRequired'));
			return;
		}
		if (name.length > 128) {
			toast.error(t('validation.nameTooLong'));
			return;
		}
		if (scopes.length === 0) {
			toast.error(t('validation.scopesRequired'));
			return;
		}
		if (ttl < 1 || ttl > 30) {
			toast.error(t('validation.ttlRange'));
			return;
		}

		setSubmitting(true);
		try {
			const resp = await TokenApi.create({
				name: name.trim(),
				scopes: scopes as (typeof VALID_SCOPES)[number][],
				ttl_days: ttl,
			});
			setNewlyCreated(resp);
			toast.success(t('createModal.success'));
			handleClose();
		} catch (e) {
			if (e instanceof ApiError) {
				if (e.code === '12002' || e.status === 403) {
					toast.error(t('validation.tokenLimit'));
				} else {
					toast.error(e.message || t('error.createFailed'));
				}
			} else {
				toast.error(t('error.createFailed'));
			}
		} finally {
			setSubmitting(false);
		}
	}, [name, scopes, ttl, t, setNewlyCreated, handleClose]);

	return (
		<Modal state={state}>
			<Modal.Backdrop />
			<Modal.Container>
				<Modal.Dialog>
					<Modal.Header>
						<Modal.Heading>{t('createModal.title')}</Modal.Heading>
						<Modal.CloseTrigger />
					</Modal.Header>
					<Modal.Body className={'flex flex-col gap-4'}>
						<TextField value={name} onChange={(v) => setName(v as string)}>
							<Label>{t('createModal.name')}</Label>
							<Input placeholder={t('createModal.namePlaceholder')} />
						</TextField>
						<CheckboxGroup
							value={scopes}
							onChange={(v) => setScopes(v as string[])}
							className={'flex flex-col gap-0'}
						>
							<Label>{t('createModal.scopes')}</Label>
							{VALID_SCOPES.map((scope) => (
								<Checkbox
									key={scope}
									value={scope}
									className={
										'flex items-start gap-3 bg-default rounded-3xl p-3 w-full cursor-pointer'
									}
								>
									<Checkbox.Control className={'mt-0.5 shrink-0'}>
										<Checkbox.Indicator />
									</Checkbox.Control>
									<Checkbox.Content
										className={'flex flex-col min-w-0 text-left'}
									>
										<span className={'text-sm font-medium text-foreground'}>
											{scope}
										</span>
										<span className={'text-xs text-muted'}>
											{t(`scope.${scope}`)}
										</span>
									</Checkbox.Content>
								</Checkbox>
							))}
						</CheckboxGroup>
						<Slider
							minValue={1}
							maxValue={30}
							value={ttl}
							onChange={(v) => setTtl(v as number)}
						>
							<Label>{t('createModal.ttl')}</Label>
							<Slider.Output />
							<Slider.Track>
								<Slider.Fill />
								<Slider.Thumb />
							</Slider.Track>
						</Slider>
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
							{t('createModal.submit')}
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal>
	);
};

export default CreateTokenModal;
