/**
 * @author Claude
 * @version 2.0
 * @date 2026/5/21
 *
 * Generic combined login surface extracted from app/sso-authorize/LoginView.tsx.
 * Accepts `onLoggedIn` callback and `namespace` i18n prop so it can be
 * reused across SSO and console pages.
 *
 * Shows the QR code as the primary login method, with a Passkey button
 * below as a secondary option (hidden automatically when unsupported).
 */
'use client';

import Image from 'next/image';
import { Separator } from '@heroui/react';
import { useTranslations } from 'next-intl';

import icon from '@/public/icon-1024.png';
import PasskeyLoginView from '@/components/PasskeyLoginView';
import QRLoginView from '@/components/QRLoginView';
import { MeResponse } from '@/services/sso/api';

interface LoginViewProps {
	onLoggedIn: (me: MeResponse) => void;
	onLoginFailed?: () => void;
	/** i18n namespace for title/subtitle, default 'sso' */
	namespace?: string;
}

const LoginView = ({
	onLoggedIn,
	onLoginFailed,
	namespace = 'sso',
}: LoginViewProps) => {
	const t = useTranslations(namespace);

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
				<QRLoginView onLoggedIn={onLoggedIn} onLoginFailed={onLoginFailed} />
				<div className={'w-full flex items-center justify-center gap-4'}>
					<Separator className={'w-16 shrink'} />
					<span className={'shrink-0 text-sm text-muted'}>
						{t('login.divider.other')}
					</span>
					<Separator className={'w-16 shrink'} />
				</div>
				<PasskeyLoginView
					onLoggedIn={onLoggedIn}
					onLoginFailed={onLoginFailed}
				/>
			</section>
		</>
	);
};

export default LoginView;
