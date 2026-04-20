/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/20
 *
 * Consent page rendered once the user is signed into HAM Web. Mirrors
 * the layout of the native App consent dialog: third-party app header,
 * scope list with descriptions, current user with a "switch account"
 * link, and the Authorize / Reject actions.
 *
 * When `can_auto_authorize` is true we start a 2s countdown that auto
 * confirms the consent. The user may cancel the countdown at any time.
 */
'use client';

import { Avatar, Button, Link } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import {
	ApiError,
	ConsentInfoResponse,
	MeResponse,
	WebAuthApi,
} from '@/services/sso/api';

interface SsoAuthorizeParams {
	appId: string;
	scope: string[];
	state: string;
	redirectUri: string;
}

interface ConsentViewProps {
	params: SsoAuthorizeParams;
	me: MeResponse;
	onSwitchAccount: () => void;
}

const AUTO_AUTHORIZE_MS = 2000;

const ConsentView = ({ params, me, onSwitchAccount }: ConsentViewProps) => {
	const t = useTranslations('sso.consent');
	const [info, setInfo] = useState<ConsentInfoResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [autoConfirmPending, setAutoConfirmPending] = useState(false);
	const autoConfirmTimer = useRef<number | null>(null);

	const bail = useCallback(
		(oauthError: 'access_denied' | 'server_error') => {
			try {
				const url = new URL(params.redirectUri);
				url.searchParams.set('error', oauthError);
				if (params.state) {
					url.searchParams.set('state', params.state);
				}
				window.location.replace(url.toString());
			} catch {
				setError(
					oauthError === 'server_error' ? t('serverError') : t('accessDenied')
				);
			}
		},
		[params.redirectUri, params.state, t]
	);

	const confirm = useCallback(
		async (nonce: string) => {
			setSubmitting(true);
			try {
				const resp = await WebAuthApi.consentConfirm({
					app_id: params.appId,
					scope: params.scope,
					redirect_uri: params.redirectUri,
					state: params.state,
					nonce,
				});
				window.location.replace(resp.redirect_url);
			} catch (e) {
				if (e instanceof ApiError) {
					toast.error(e.message || t('submitFailed'));
				} else {
					toast.error(t('submitFailed'));
				}
				bail('server_error');
			} finally {
				setSubmitting(false);
			}
		},
		[bail, params.appId, params.redirectUri, params.scope, params.state, t]
	);

	// Load consent info on mount. The backend issues a fresh nonce each
	// time, so we always fetch before mounting the action buttons.
	useEffect(() => {
		let cancelled = false;
		WebAuthApi.consentInfo({
			app_id: params.appId,
			scope: params.scope,
			redirect_uri: params.redirectUri,
			state: params.state,
		})
			.then((resp) => {
				if (cancelled) return;
				setInfo(resp);
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				if (e instanceof ApiError) {
					setError(e.message || t('fetchFailed'));
				} else {
					setError(t('fetchFailed'));
				}
			});
		return () => {
			cancelled = true;
		};
	}, [params.appId, params.redirectUri, params.scope, params.state, t]);

	// Auto-authorize countdown when the backend says all requested scopes
	// were already granted.
	useEffect(() => {
		if (!info || !info.can_auto_authorize) {
			return;
		}
		setAutoConfirmPending(true);
		autoConfirmTimer.current = window.setTimeout(() => {
			confirm(info.nonce);
		}, AUTO_AUTHORIZE_MS);
		return () => {
			if (autoConfirmTimer.current !== null) {
				window.clearTimeout(autoConfirmTimer.current);
				autoConfirmTimer.current = null;
			}
		};
	}, [info, confirm]);

	const cancelAutoConfirm = useCallback(() => {
		if (autoConfirmTimer.current !== null) {
			window.clearTimeout(autoConfirmTimer.current);
			autoConfirmTimer.current = null;
		}
		setAutoConfirmPending(false);
	}, []);

	if (error) {
		return (
			<div
				className={
					'min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-default p-4'
				}
			>
				<div
					className={
						'bg-surface rounded-[16px] p-8 max-w-md w-full min-w-0 flex flex-col gap-4 text-center items-center'
					}
				>
					<div className={'text-5xl'}>⚠️</div>
					<h1 className={'text-xl font-bold text-foreground'}>
						{t('errorTitle')}
					</h1>
					<p className={'text-sm text-muted'}>{error}</p>
					<Button variant={'primary'} onPress={() => bail('server_error')}>
						{t('backToThirdParty')}
					</Button>
				</div>
			</div>
		);
	}

	if (!info) {
		return <div className={'min-h-screen'} />;
	}

	return (
		<div
			className={
				'min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-default px-4 md:px-12 lg:px-24 py-8'
			}
		>
			<div
				className={
					'bg-surface rounded-[16px] p-6 md:p-10 w-full max-w-xl min-w-0 flex flex-col gap-6'
				}
			>
				<header className={'flex items-center gap-4 min-w-0'}>
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
					<div className={'flex flex-col min-w-0'}>
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

				<section className={'flex flex-col gap-2'}>
					<h2 className={'text-sm font-medium text-muted'}>
						{t('scopeHeader')}
					</h2>
					<ul className={'flex flex-col gap-2'}>
						{info.scopes.map((s) => (
							<li
								key={s.scope}
								className={
									'flex items-start gap-2 bg-default rounded-[12px] p-3'
								}
							>
								<span
									className={
										'material-icons-round text-accent !text-[20px] mt-0.5 shrink-0'
									}
								>
									check_circle
								</span>
								<div className={'flex flex-col min-w-0'}>
									<span
										className={
											'text-sm font-medium text-foreground break-words'
										}
									>
										{s.description}
									</span>
									{s.already_granted && (
										<span className={'text-xs text-muted'}>
											{t('alreadyGranted')}
										</span>
									)}
								</div>
							</li>
						))}
					</ul>
				</section>

				<footer
					className={
						'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-border pt-4'
					}
				>
					<div className={'flex items-center gap-2 min-w-0'}>
						<Avatar size={'sm'}>
							{me.avatar_url ? (
								<Avatar.Image src={me.avatar_url} alt={me.nickname ?? ''} />
							) : null}
							<Avatar.Fallback>
								{(me.nickname ?? me.user_id ?? '?').slice(0, 1)}
							</Avatar.Fallback>
						</Avatar>
						{/*
						 * `min-w-0` on both the row and the column is what actually
						 * lets `truncate` work inside a flex container — without it
						 * the child's intrinsic content width wins and overflows the
						 * viewport on narrow phones.
						 */}
						<div className={'flex flex-col min-w-0'}>
							<span
								className={'text-sm font-semibold truncate text-foreground'}
							>
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
					{/*
					 * On mobile the two action buttons stack below the user
					 * row and each take half the width so they read as a
					 * clear pair. On ≥sm the footer becomes a single row
					 * with the user on the left and the buttons on the right
					 * (original desktop layout).
					 */}
					<div
						className={
							'flex items-center gap-2 sm:shrink-0 [&>*]:flex-1 sm:[&>*]:flex-none'
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
							onPress={() => {
								cancelAutoConfirm();
								confirm(info.nonce);
							}}
						>
							{autoConfirmPending ? t('autoAuthorize') : t('authorize')}
						</Button>
					</div>
				</footer>
			</div>
		</div>
	);
};

export default ConsentView;
