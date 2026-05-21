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
	Form,
	Input,
	Label,
	Modal,
	NumberField,
	TextField,
} from '@heroui/react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import {
	createModalVisibleAtom,
	newlyCreatedTokenAtom,
} from '@/app/console/tokens/store';
import { ApiError, TokenApi, VALID_SCOPES } from '@/services/token/api';

const PARENT_SCOPE = 'mcp';
const CHILD_SCOPES = ['mcp:read', 'mcp:write'] as const;

const CreateTokenModal = () => {
	const t = useTranslations('apikey');
	const tc = useTranslations('common');
	const [visible, setVisible] = useAtom(createModalVisibleAtom);
	const setNewlyCreated = useSetAtom(newlyCreatedTokenAtom);
	const [name, setName] = useState('');
	const [scopes, setScopes] = useState<string[]>([]);
	const [ttl, setTtl] = useState(30);
	const [submitting, setSubmitting] = useState(false);

	const isParentChecked = scopes.includes(PARENT_SCOPE);

	const isParentIndeterminate = useMemo(() => {
		const checkedChildren = CHILD_SCOPES.filter((c) => scopes.includes(c));
		return (
			checkedChildren.length > 0 && checkedChildren.length < CHILD_SCOPES.length
		);
	}, [scopes]);

	const handleScopeChange = useCallback((scope: string, checked: boolean) => {
		setScopes((prev) => {
			if (scope === PARENT_SCOPE) {
				if (checked) {
					// Check parent + all children
					return [...new Set([PARENT_SCOPE, ...CHILD_SCOPES, ...prev])];
				}
				// Uncheck parent + all children (avoid auto-re-check from all-children-selected)
				return prev.filter(
					(s) =>
						s !== PARENT_SCOPE &&
						!CHILD_SCOPES.includes(s as (typeof CHILD_SCOPES)[number])
				);
			}
			// Child scope
			let next = checked ? [...prev, scope] : prev.filter((s) => s !== scope);
			// If unchecking a child, remove parent
			if (!checked) {
				next = next.filter((s) => s !== PARENT_SCOPE);
			}
			// If all children checked, auto-check parent
			if (CHILD_SCOPES.every((c) => next.includes(c))) {
				if (!next.includes(PARENT_SCOPE)) {
					next.push(PARENT_SCOPE);
				}
			}
			return next;
		});
	}, []);

	/** Normalize: if parent is selected, only send parent (children are implied) */
	const normalizedScopes = useMemo(() => {
		if (scopes.includes(PARENT_SCOPE)) {
			return [PARENT_SCOPE];
		}
		return scopes;
	}, [scopes]);

	const handleClose = useCallback(() => {
		setVisible(false);
		setName('');
		setScopes([]);
		setTtl(30);
	}, [setVisible]);

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
				scopes: normalizedScopes as (typeof VALID_SCOPES)[number][],
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
	}, [name, scopes, normalizedScopes, ttl, t, setNewlyCreated, handleClose]);

	return (
		<Modal>
			<Modal.Backdrop
				isOpen={visible}
				onOpenChange={(open) => {
					if (!open) handleClose();
				}}
			>
				<Modal.Container>
					<Modal.Dialog>
						<Modal.Header>
							<Modal.Heading>{t('createModal.title')}</Modal.Heading>
							<Modal.CloseTrigger />
						</Modal.Header>
						<Modal.Body className={'overflow-visible'}>
							<Form className={'flex flex-col gap-4'}>
								<TextField value={name} onChange={(v) => setName(v as string)}>
									<Label>{t('createModal.name')}</Label>
									<Input
										variant='secondary'
										placeholder={t('createModal.namePlaceholder')}
									/>
								</TextField>
								<div className={'flex flex-col gap-0'}>
									<Label className={'mb-2'}>{t('createModal.scopes')}</Label>
									<span className={'text-xs font-medium text-muted mb-1'}>
										{t('scopeGroup.mcp')}
									</span>
									<Checkbox
										isSelected={isParentChecked}
										isIndeterminate={isParentIndeterminate}
										onChange={(v) => handleScopeChange(PARENT_SCOPE, v)}
										className={
											'flex items-start gap-3 bg-default rounded-[12px] p-3 w-full cursor-pointer mt-2'
										}
									>
										<Checkbox.Control className={'mt-0.5 shrink-0'}>
											<Checkbox.Indicator />
										</Checkbox.Control>
										<Checkbox.Content
											className={'flex flex-col min-w-0 text-left'}
										>
											<span className={'text-sm font-medium text-foreground'}>
												{PARENT_SCOPE}
											</span>
											<span className={'text-xs text-muted'}>
												{t(`scope.${PARENT_SCOPE}`)}
											</span>
										</Checkbox.Content>
									</Checkbox>
									<div
										className={
											'ml-6 flex flex-col gap-0 border-l border-default pl-3'
										}
									>
										{CHILD_SCOPES.map((scope) => (
											<Checkbox
												key={scope}
												isSelected={scopes.includes(scope)}
												onChange={(v) => handleScopeChange(scope, v)}
												className={'flex items-start gap-3 rounded-[12px] p-3 w-full cursor-pointer'}
											>
												<Checkbox.Control className={'mt-0.5 shrink-0'}>
													<Checkbox.Indicator />
												</Checkbox.Control>
												<Checkbox.Content
													className={'flex flex-col min-w-0 text-left'}
												>
													<span
														className={'text-sm font-medium text-foreground'}
													>
														{scope}
													</span>
													<span className={'text-xs text-muted'}>
														{t(`scope.${scope}`)}
													</span>
												</Checkbox.Content>
											</Checkbox>
										))}
									</div>
								</div>
								<NumberField
									value={ttl}
									onChange={(v) => setTtl(v ?? 1)}
									minValue={1}
									maxValue={30}
									variant='secondary'
								>
									<Label>{t('createModal.ttl')}</Label>
									<NumberField.Group>
										<NumberField.DecrementButton />
										<NumberField.Input />
										<NumberField.IncrementButton />
									</NumberField.Group>
								</NumberField>
							</Form>
						</Modal.Body>
						<Modal.Footer>
							<Button slot='close' variant={'tertiary'}>
								{tc('cancel')}
							</Button>
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
			</Modal.Backdrop>
		</Modal>
	);
};

export default CreateTokenModal;
