/**
 * @author Claude
 * @version 2.0
 * @date 2026/5/22
 *
 * Modal for creating a new API token with name, scopes, and TTL.
 * Rendering-only — all logic in useCreateToken.
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
import { useTranslations } from 'next-intl';

import {
	useCreateToken,
	PARENT_SCOPE,
	CHILD_SCOPES,
} from '@/app/console/tokens/useCreateToken';

const CreateTokenModal = () => {
	const t = useTranslations('apikey');
	const {
		visible,
		name,
		setName,
		scopes,
		ttl,
		setTtl,
		submitting,
		isParentChecked,
		isParentIndeterminate,
		handleScopeChange,
		handleClose,
		handleSubmit,
	} = useCreateToken();

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
												className={
													'flex items-start gap-3 rounded-[12px] p-3 w-full cursor-pointer'
												}
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
