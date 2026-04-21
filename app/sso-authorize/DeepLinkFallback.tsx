/**
 * @author Claude
 * @version 1.3
 * @date 2026/4/21 12:43:48
 *
 * Mobile fallback view shown when the `ham://sso-authorize` deep link did
 * not switch the user to the native HAM App. Offers three exit doors,
 * laid out vertically on the same card (no page switch):
 *   1. Download HAM App (platform-aware store link) — primary CTA.
 *   2. Retry the deep link — useful when the user just installed the App.
 *   3. Sign in with Passkey in the browser — inlined under a divider, only
 *      rendered when the browser actually supports WebAuthn so we don't
 *      dead-end the user.
 */
'use client';

import { Button, Link, Separator } from '@heroui/react';
import { useMemo, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';

import {
	detectDeviceKind,
	getAppStoreURL,
	isPasskeySupported,
} from '@/services/sso/ua';
import HeaderBar from '@/app/sso-authorize/HeaderBar';
import PasskeyLoginView from '@/app/sso-authorize/PasskeyLoginView';

// Passkey support never changes at runtime, so subscribe() is a no-op —
// useSyncExternalStore gives us an SSR-safe client-only boolean without
// tripping the react-hooks/set-state-in-effect lint.
const subscribePasskey = () => () => undefined;
const getPasskeyClient = () => isPasskeySupported();
const getPasskeyServer = () => false;

interface DeepLinkFallbackProps {
	reopenApp: () => void;
	/**
	 * Invoked when Passkey authentication succeeds. The parent is
	 * responsible for re-reading the session and transitioning into
	 * the consent stage — same contract that `LoginView` uses.
	 */
	onLoggedIn: () => void;
}

const DeepLinkFallback = ({ reopenApp, onLoggedIn }: DeepLinkFallbackProps) => {
	const t = useTranslations('sso');
	const deviceKind = useMemo(() => {
		if (typeof navigator === 'undefined') return 'desktop' as const;
		return detectDeviceKind(navigator.userAgent);
	}, []);
	const storeUrl = useMemo(() => getAppStoreURL(deviceKind), [deviceKind]);
	// Passkey availability is only known on the client.
	// useSyncExternalStore is React's official SSR-safe way to expose a
	// browser-only value without triggering the set-state-in-effect rule.
	const passkeySupported = useSyncExternalStore(
		subscribePasskey,
		getPasskeyClient,
		getPasskeyServer
	);

	return (
		<div
			className={
				'min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-default px-4 py-16'
			}
		>
			<HeaderBar />
			<div
				className={
					'bg-surface rounded-[16px] p-6 w-full max-w-md flex flex-col gap-5'
				}
			>
				<header className={'flex flex-col items-center text-center gap-2'}>
					<div className={'text-5xl'}>📱</div>
					<h1 className={'text-xl font-bold text-foreground'}>
						{t('deepLink.title')}
					</h1>
					<p className={'text-sm text-muted'}>{t('deepLink.description')}</p>
				</header>

				<div className={'flex flex-col gap-3'}>
					{/* v3 Button dropped the `as` polymorphic prop. Wrap in a
					    native anchor so the primary CTA still navigates to the
					    store/download page while keeping the Button styling. */}
					<a
						href={storeUrl}
						target={'_blank'}
						rel={'noreferrer'}
						className={'contents'}
					>
						<Button variant={'primary'} className={'w-full'}>
							<span
								className={'material-icons-round !text-[18px] !leading-none'}
								aria-hidden={true}
							>
								get_app
							</span>
							{deviceKind === 'ios'
								? t('deepLink.downloadAppStore')
								: t('deepLink.download')}
						</Button>
					</a>
					{/*
					 * "I already installed it" is a secondary escape hatch —
					 * rendered as a text link so it doesn't compete with the
					 * primary download CTA above.
					 */}
					<div
						className={
							'flex flex-col items-center gap-2 text-sm text-center pt-1'
						}
					>
						<Link
							onPress={reopenApp}
							className={'cursor-pointer text-accent hover:underline'}
						>
							{t('deepLink.reopen')}
						</Link>
					</div>
				</div>

				{/*
				 * Passkey is now rendered inline rather than sending the user
				 * to a separate /login page — on mobile the fallback card is
				 * already the "login" surface, so a second page switch just
				 * added friction. We reuse the existing `login.divider.other`
				 * copy ("Or sign in with") so the wording stays consistent
	 * with LoginView on desktop.
				 *
				 * Rendered only when WebAuthn is actually available; on
				 * unsupported browsers we fall through to "install the app"
				 * as the sole path, which is the honest answer.
				 */}
				{passkeySupported && (
					<>
						<div className={'w-full flex items-center justify-center gap-4'}>
							<Separator className={'w-16 shrink'} />
							<span className={'shrink-0 text-sm text-muted'}>
								{t('login.divider.other')}
							</span>
							<Separator className={'w-16 shrink'} />
						</div>
					<PasskeyLoginView compact={true} onLoggedIn={onLoggedIn} />
					</>
				)}
			</div>
		</div>
	);
};

export default DeepLinkFallback;
