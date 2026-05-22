/**
 * @author Claude
 * @version 1.9
 * @date 2026/5/22
 *
 * Mobile fallback view shown when the `ham://sso-authorize` deep link did
 * not switch the user to the native HAM App. Offers three exit doors,
 * laid out vertically on the same card (no page switch):
 *   1. Download HAM App (platform-aware store link) — primary CTA.
 *   2. Retry the deep link — useful when the user just installed the App.
 *   3. Sign in with browser — navigates to /login with the current URL
 *      as the return destination.
 *
 * Reads `deepLinkUrlAtom` directly — no props needed.
 */
'use client';

import Image from 'next/image';
import { Button, Link, Separator } from '@heroui/react';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import icon from '@/public/icon-1024.png';
import { detectDeviceKind, getAppStoreURL } from '@/services/sso/ua';
import { deepLinkUrlAtom } from '@/app/sso-authorize/store';

const DeepLinkFallback = () => {
	const t = useTranslations('sso');
	const deepLinkUrl = useAtomValue(deepLinkUrlAtom);

	const deviceKind = useMemo(() => {
		if (typeof navigator === 'undefined') return 'desktop' as const;
		return detectDeviceKind(navigator.userAgent);
	}, []);
	const storeUrl = useMemo(() => getAppStoreURL(deviceKind), [deviceKind]);

	const reopenApp = () => {
		if (!deepLinkUrl) return;
		window.location.href = deepLinkUrl;
	};

	const goToLogin = () => {
		const from = encodeURIComponent(
			window.location.pathname + window.location.search
		);
		window.location.href = `/login?from=${from}`;
	};

	return (
		<>
			<header className={'flex flex-col items-center text-center gap-2'}>
				<Image src={icon} alt={'logo'} className={'size-16 rounded-[12px]'} />
				<h1 className={'text-xl font-bold text-foreground'}>
					{t('deepLink.title')}
				</h1>
				<p className={'text-sm text-muted'}>{t('deepLink.description')}</p>
			</header>

			<div className={'flex flex-col gap-3'}>
				<a
					href={storeUrl}
					target={'_blank'}
					rel={'noreferrer'}
					className={'contents'}
				>
					<Button variant={'primary'} className={'w-full'}>
						<span
							className={'material-icons-round text-[18px]! leading-none!'}
							aria-hidden={true}
						>
							get_app
						</span>
						{deviceKind === 'ios'
							? t('deepLink.downloadAppStore')
							: t('deepLink.download')}
					</Button>
				</a>
				<div
					className={
						'flex flex-col items-center gap-2 text-sm text-center pt-1'
					}
				>
					<Link onPress={reopenApp}>{t('deepLink.reopen')}</Link>
				</div>
			</div>

			<div className={'w-full flex items-center justify-center gap-4'}>
				<Separator className={'w-16 shrink'} />
				<span className={'shrink-0 text-sm text-muted'}>
					{t('login.divider.other')}
				</span>
				<Separator className={'w-16 shrink'} />
			</div>
			<Button variant={'tertiary'} className={'w-full'} onPress={goToLogin}>
				<span
					className={'material-icons-round text-[18px]! leading-none!'}
					aria-hidden={true}
				>
					login
				</span>
				{t('login.signInBrowser')}
			</Button>
		</>
	);
};

export default DeepLinkFallback;
