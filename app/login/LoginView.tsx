/**
 * @author Claude
 * @version 2.1
 * @date 2026/9/15 13:42:12
 *
 * Combined login surface for the /login page.
 *
 * Desktop: QR code (primary) + Passkey (secondary) + browser OAuth providers.
 * Mobile:  Open App (primary) + Passkey (secondary) + browser OAuth providers.
 * QR is hidden on mobile.
 *
 * Mobile app login: before launching the deep link, calls the
 * setLoginCookies server action to write HttpOnly cookies (state + from)
 * and read the first-party client id, then builds the deep-link URL from
 * both. The client id must come from the server because it is a Worker
 * var — a build-time `process.env` read in this client component would
 * be inlined as an empty string.
 */

'use client';

import Image from 'next/image';
import { Button, Separator } from '@heroui/react';
import { useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import toast from 'react-hot-toast';

import { setLoginCookies } from '@/app/login/actions';
import OAuthProviderButtons from '@/components/login/OAuthProviderButtons';
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
		// The state cookie and the client id both come from the server: the
		// client id is a Worker var that only exists at request time, so a
		// build-time `process.env` read here would inline an empty string.
		const { state, clientId } = await setLoginCookies(from);
		if (!clientId) {
			// Surfacing the failure beats launching a deep link the App is
			// guaranteed to drop for having an empty client_id.
			toast.error(t('login.openAppUnavailable'));
			return;
		}
		const url = buildSsoAuthorizeDeepLink({
			appId: clientId,
			scope: [],
			state,
			redirectUri: `${window.location.origin}${APP_CALLBACK_PATH}`,
		});
		tryLaunchDeepLink({ url });
	}, [from, t]);

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
						<Button variant={'primary'} onPress={handleOpenApp}>
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

				<OAuthProviderButtons from={from} />
			</section>
		</>
	);
};

export default LoginView;
