/**
 * @author Claude
 * @version 2.1
 * @date 2026/5/22
 *
 * Mobile fallback view shown when the `ham://sso-authorize` deep link did
 * not switch the user to the native HAM App.
 *
 * When the user IS authenticated:
 *   1. Download HAM App — primary CTA.
 *   2. Retry the deep link — useful when the user just installed the App.
 *   3. Sign in with browser — navigates to /login with the current URL
 *      as the return destination.
 *
 * When the user is NOT authenticated:
 *   1. Download HAM App — primary CTA.
 *   2. Retry the deep link.
 *   3. Passkey login — inline passkey sign-in; on success, reloads the
 *      page so the server can pick up the new session.
 *   4. Browser OAuth providers — QQ / GitHub / Apple browser logins.
 */

'use client';

import Image from 'next/image';
import { Button, Link, Separator } from '@heroui/react';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import PasskeyLoginView from '@/app/login/PasskeyLoginView';
import OAuthProviderButtons from '@/components/login/OAuthProviderButtons';
import icon from '@/public/icon-1024.png';
import { getAppStoreURL } from '@/services/sso/ua';
import { deepLinkUrlAtom, deviceKindAtom } from '@/app/sso-authorize/store';

interface DeepLinkFallbackProps {
	isAuthenticated: boolean;
	from: string;
}

const DeepLinkFallback = ({ isAuthenticated, from }: DeepLinkFallbackProps) => {
	const t = useTranslations('sso');
	const deepLinkUrl = useAtomValue(deepLinkUrlAtom);
	const deviceKind = useAtomValue(deviceKindAtom);

	const storeUrl = useMemo(() => getAppStoreURL(deviceKind), [deviceKind]);

	const reopenApp = () => {
		if (!deepLinkUrl) return;
		window.location.href = deepLinkUrl;
	};

	const goToLogin = () => {
		window.location.href = `/login?from=${encodeURIComponent(from)}`;
	};

	const onPasskeyLoginSucceeded = () => {
		// Reload so the server re-checks auth and renders consent view
		window.location.reload();
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

			<div className={'flex flex-col items-center'}>
				{isAuthenticated ? (
					<Button variant={'tertiary'} onPress={goToLogin}>
						<span
							className={'material-icons-round text-[18px]! leading-none!'}
							aria-hidden={true}
						>
							login
						</span>
						{t('login.signInBrowser')}
					</Button>
				) : (
					<div className={'w-full flex flex-col items-center gap-6'}>
						<PasskeyLoginView onLoginSucceeded={onPasskeyLoginSucceeded} />
						<OAuthProviderButtons from={from} namespace={'sso'} />
					</div>
				)}
			</div>
		</>
	);
};

export default DeepLinkFallback;
