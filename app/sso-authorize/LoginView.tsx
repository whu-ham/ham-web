/**
 * @author Claude
 * @version 3.1
 * @date 2026/4/21 19:05:24
 *
 * Combined login surface for the /sso-authorize page.
 * Shows the QR code as the primary login method, with a Passkey button
 * below as a secondary option (hidden automatically when unsupported).
 */
'use client';

import Image from 'next/image';
import { Separator } from '@heroui/react';
import { useTranslations } from 'next-intl';

import icon from '@/public/icon-1024.png';
import PasskeyLoginView from '@/app/sso-authorize/PasskeyLoginView';
import QRLoginView from '@/app/sso-authorize/QRLoginView';

const LoginView = () => {
	const t = useTranslations('sso');

	return (
		<>
			<header
				className={
					'flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6'
				}
			>
				<Image src={icon} alt={'logo'} className={'size-16 rounded-[12px]'} />
				<div className={'flex flex-col items-start'}>
					<h1 className={'text-xl font-bold text-foreground'}>
						{t('login.title')}
					</h1>
					<p className={'text-sm text-muted'}>{t('login.subtitle')}</p>
				</div>
			</header>

			<section className={'flex flex-col items-center gap-6'}>
				<QRLoginView />
				<div className={'w-full flex items-center justify-center gap-4'}>
					<Separator className={'w-16 shrink'} />
					<span className={'shrink-0 text-sm text-muted'}>
						{t('login.divider.other')}
					</span>
					<Separator className={'w-16 shrink'} />
				</div>
				<PasskeyLoginView />
			</section>
		</>
	);
};

export default LoginView;
