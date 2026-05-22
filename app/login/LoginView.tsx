/**
 * Combined login surface for the /login page.
 *
 * Desktop: QR code (primary) + Passkey (secondary)
 * Mobile:  Open App (primary) + Passkey (secondary). QR is hidden.
 *
 * Mobile app login: before launching the deep link, calls the
 * setLoginCookies server action to write HttpOnly cookies (state + from),
 * then builds the deep-link URL with the returned state.
 */

'use client';

import Image from 'next/image';
import { Button, Separator } from '@heroui/react';
import { useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { setLoginCookies } from '@/app/login/actions';
import icon from '@/public/icon-1024.png';
import PasskeyLoginView from '@/app/login/PasskeyLoginView';
import QRLoginView from '@/app/login/QRLoginView';
import { APP_CALLBACK_PATH, mobileAtom } from '@/app/login/store';
import {
	buildSsoAuthorizeDeepLink,
	tryLaunchDeepLink,
} from '@/services/sso/deepLink';

interface LoginViewProps {
	/** i18n namespace for title/subtitle, default 'sso' */
	namespace?: string;
	/** Redirect target after login (used to set FROM_COOKIE). */
	from: string;
	/** Called when login succeeds (session cookie already set by backend) */
	onLoginSucceeded?: () => void;
}

const LoginView = ({
	namespace = 'sso',
	from,
	onLoginSucceeded,
}: LoginViewProps) => {
	const t = useTranslations(namespace);
	const mobile = useAtomValue(mobileAtom);

	const handleOpenApp = useCallback(async () => {
		// 1. Set HttpOnly cookies (state + from) via server action
		const state = await setLoginCookies(from);
		// 2. Build the deep-link URL with the server-generated state
		const url = buildSsoAuthorizeDeepLink({
			appId: process.env.NEXT_PUBLIC_CONSOLE_CLIENT_ID ?? '',
			scope: [],
			state,
			redirectUri: `${window.location.origin}${APP_CALLBACK_PATH}`,
		});
		// 3. Launch the app
		tryLaunchDeepLink({ url });
	}, [from]);

	return (
		<>
			<header
				className={
					'flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6'
				}
			>
				<Image src={icon} alt={'logo'} className={'size-16 rounded-[12px]'} />
				<div className={'flex flex-col items-center md:items-start'}>
					<h1 className={'text-xl font-bold text-foreground'}>
						{t('login.title')}
					</h1>
					<p className={'text-sm text-muted'}>{t('login.subtitle')}</p>
				</div>
			</header>

			<section className={'flex flex-col items-center gap-6'}>
				{/* Desktop: QR code as primary login */}
				{!mobile && <QRLoginView onLoginSucceeded={onLoginSucceeded} />}

				{!mobile && (
					<div className={'w-full flex items-center justify-center gap-4'}>
						<Separator className={'w-16 shrink'} />
						<span className={'shrink-0 text-sm text-muted'}>
							{t('login.divider.other')}
						</span>
						<Separator className={'w-16 shrink'} />
					</div>
				)}

				<PasskeyLoginView onLoginSucceeded={onLoginSucceeded} />

				{mobile && (
					<>
						<div className={'w-full flex items-center justify-center gap-4'}>
							<Separator className={'w-16 shrink'} />
							<span className={'shrink-0 text-sm text-muted'}>
								{t('login.divider.other')}
							</span>
							<Separator className={'w-16 shrink'} />
						</div>
						<Button
							variant={'primary'}
							className={'w-full'}
							onPress={handleOpenApp}
						>
							<span
								className={'material-icons-round text-[18px]! leading-none!'}
								aria-hidden={true}
							>
								smartphone
							</span>
							{t('login.openApp')}
						</Button>
					</>
				)}
			</section>
		</>
	);
};

export default LoginView;
