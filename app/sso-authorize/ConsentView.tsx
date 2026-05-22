/**
 * @author Claude
 * @version 3.0
 * @date 2026/5/22
 *
 * Consent page rendered once the user is signed into HAM Web.
 * Rendering-only — all logic lives in useConsent.
 */

'use client';

import {
	Avatar,
	Button,
	Checkbox,
	CheckboxGroup,
	Link,
	Spinner,
} from '@heroui/react';
import { useTranslations } from 'next-intl';

import { useConsent } from '@/app/sso-authorize/useConsent';

const ConsentView = () => {
	const t = useTranslations('sso.consent');
	const {
		me,
		info,
		error,
		submitting,
		checkedScopes,
		setCheckedScopes,
		onSwitchAccount,
		bail,
		confirm,
	} = useConsent();

	if (error) {
		return (
			<div className={'flex flex-col items-center text-center gap-6'}>
				<div className={'text-5xl'}>⚠️</div>
				<h1 className={'text-xl font-bold text-foreground'}>
					{t('errorTitle')}
				</h1>
				<p className={'text-sm text-muted'}>{error}</p>
				<Button variant={'primary'} onPress={() => bail('server_error')}>
					{t('backToThirdParty')}
				</Button>
			</div>
		);
	}

	if (!me || !info) {
		return (
			<div
				className={
					'fixed inset-0 flex items-center justify-center bg-default z-50'
				}
			>
				<Spinner size={'lg'} />
			</div>
		);
	}

	return (
		<>
			<header className={'flex items-start gap-4 w-full min-w-0'}>
				{info.app.icon_url && (
					// Using native img to avoid next/image whitelist friction
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={info.app.icon_url}
						alt={info.app.name}
						className={'size-14 rounded-[12px] shrink-0'}
					/>
				)}
				{/*
				 * `min-w-0` is essential here — without it the text column
				 * cannot shrink below its intrinsic content width inside a
				 * flex parent, so a long app name would widen the card past
				 * the viewport on mobile. `break-words` handles the (rare)
				 * super-long unbroken string case.
				 */}
				<div className={'flex flex-col min-w-0 overflow-hidden'}>
					<h1 className={'text-lg font-bold text-foreground break-words'}>
						{info.app.name}
					</h1>
					{info.app.description && (
						<p className={'text-sm text-muted break-words'}>
							{info.app.description}
						</p>
					)}
				</div>
			</header>

			{info.can_auto_authorize && (
				<div
					className={
						'w-full flex items-center gap-2 bg-default rounded-[12px] px-3 py-2 text-sm text-muted'
					}
				>
					<span
						className={
							'material-icons-round text-[16px]! leading-none! shrink-0'
						}
						aria-hidden={true}
					>
						check_circle
					</span>
					{t('previouslyAuthorized')}
				</div>
			)}

			<section className={'flex flex-col gap-2'}>
				<h2 className={'text-sm font-medium text-muted'}>{t('scopeHeader')}</h2>
				<CheckboxGroup
					value={checkedScopes}
					onChange={(v) => {
						const next = new Set(v as string[]);
						info.scopes.forEach((s) => {
							if (s.required) next.add(s.scope);
						});
						setCheckedScopes(Array.from(next));
					}}
					className={'flex flex-col gap-0'}
				>
					{info.scopes.map((s) => (
						<Checkbox
							key={s.scope}
							value={s.scope}
							isDisabled={s.required || s.already_granted}
							className={
								'flex items-start gap-3 bg-default rounded-[12px] p-3 w-full cursor-pointer'
							}
						>
							<Checkbox.Control className={'mt-0.5 shrink-0'}>
								<Checkbox.Indicator />
							</Checkbox.Control>
							<Checkbox.Content className={'flex flex-col min-w-0 text-left'}>
								<span
									className={'text-sm font-medium text-foreground break-words'}
								>
									{s.description}
								</span>
								{s.required ? (
									<span className={'text-xs text-muted'}>{t('required')}</span>
								) : (
									s.already_granted && (
										<span className={'text-xs text-muted'}>
											{t('alreadyGranted')}
										</span>
									)
								)}
							</Checkbox.Content>
						</Checkbox>
					))}
				</CheckboxGroup>
			</section>

			<footer
				className={
					'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-border pt-4 w-full min-w-0'
				}
			>
				<div
					className={
						'flex items-center gap-2 min-w-0 overflow-hidden sm:flex-1'
					}
				>
					<Avatar size={'sm'}>
						{me.avatar_url ? (
							<Avatar.Image src={me.avatar_url} alt={me.nickname ?? ''} />
						) : null}
						<Avatar.Fallback>
							{(me.nickname ?? me.user_id ?? '?').slice(0, 1)}
						</Avatar.Fallback>
					</Avatar>
					<div className={'flex flex-col items-start min-w-0'}>
						<span className={'text-sm font-semibold truncate text-foreground'}>
							{me.nickname ?? me.user_id}
						</span>
						<Link
							className={'cursor-pointer text-sm'}
							onPress={onSwitchAccount}
						>
							{t('switchAccount')}
						</Link>
					</div>
				</div>
				<div
					className={
						'flex items-center gap-2 w-full sm:w-auto sm:shrink-0 [&>*]:flex-1 sm:[&>*]:flex-none'
					}
				>
					<Button
						variant={'tertiary'}
						isDisabled={submitting}
						onPress={() => bail('access_denied')}
					>
						{t('reject')}
					</Button>
					<Button
						variant={'primary'}
						isPending={submitting}
						onPress={() => confirm(info.nonce)}
					>
						{t('authorize')}
					</Button>
				</div>
			</footer>
		</>
	);
};

export default ConsentView;
