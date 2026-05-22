/**
 * Combined login surface for the /login page.
 * Shows the QR code as the primary login method, with a Passkey button
 * below as a secondary option (hidden automatically when unsupported).
 */

'use client';

import Image from 'next/image';
import { Button, Separator } from '@heroui/react';
import { useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import icon from '@/public/icon-1024.png';
import PasskeyLoginView from '@/app/login/PasskeyLoginView';
import QRLoginView from '@/app/login/QRLoginView';
import { deepLinkUrlAtom, mobileAtom } from '@/app/login/store';
import { tryLaunchDeepLink } from '@/services/sso/deepLink';

interface LoginViewProps {
	/** i18n namespace for title/subtitle, default 'sso' */
	namespace?: string;
	/** Called when login succeeds (session cookie already set by backend) */
	onLoginSucceeded?: () => void;
}

const LoginView = ({ namespace = 'sso', onLoginSucceeded }: LoginViewProps) => {
	const t = useTranslations(namespace);
	const mobile = useAtomValue(mobileAtom);
	const deepLinkUrl = useAtomValue(deepLinkUrlAtom);

	const handleOpenApp = useCallback(() => {
		tryLaunchDeepLink({ url: deepLinkUrl });
	}, [deepLinkUrl]);

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
				<QRLoginView onLoginSucceeded={onLoginSucceeded} />
				<div className={'w-full flex items-center justify-center gap-4'}>
					<Separator className={'w-16 shrink'} />
					<span className={'shrink-0 text-sm text-muted'}>
						{t('login.divider.other')}
					</span>
					<Separator className={'w-16 shrink'} />
				</div>
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
