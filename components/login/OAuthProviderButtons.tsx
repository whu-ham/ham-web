/**
 * @author Claude
 * @version 1.1
 * @date 2026/09/10 20:26:42
 *
 * Shared browser OAuth provider entry list for login surfaces.
 *
 * Rendering only — endpoints and state handling live in
 * `services/oauth-providers`. Icon assets are picked per resolved
 * theme rather than a CSS filter, because the brand marks have
 * prescribed light and dark variants. Theme-dependent output is
 * deferred until mount to avoid a hydration mismatch.
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

import {
	buildLoginOAuthStartHref,
	OAUTH_PROVIDER_CONFIGS,
	OAUTH_PROVIDER_IDS,
} from '@/services/oauth-providers';
import { OAUTH_PROVIDER_BUTTON_CONFIGS } from '@/components/login/oauthProviderButtonConfig';
import { resolvedThemeAtom } from '@/store/themeAtom';

interface OAuthProviderButtonsProps {
	from: string;
}

// `useSyncExternalStore` needs a store whose snapshot flips once on mount.
// The subscribe callback is never invoked, so React never re-reads the
// value after the initial client render.
const subscribeToMount = () => () => {};
const getMountSnapshot = () => true;
const getServerMountSnapshot = () => false;

const OAuthProviderButtons = ({ from }: OAuthProviderButtonsProps) => {
	const t = useTranslations('login');
	const resolvedTheme = useAtomValue(resolvedThemeAtom);

	// `systemThemeAtom` is seeded from `detectSystemTheme()` at module load,
	// which resolves to 'light' on the server but can be 'dark' on a client
	// whose OS prefers dark. Rendering theme-dependent icons and colours on
	// the first pass would then mismatch the server HTML and trip a
	// hydration error, so the theme is only applied once mounted.
	const mounted = useSyncExternalStore(
		subscribeToMount,
		getMountSnapshot,
		getServerMountSnapshot
	);
	const isDarkTheme = mounted && resolvedTheme === 'dark';

	return (
		<div className={'w-full flex flex-col gap-3'}>
			<div className={'text-sm text-muted text-center'}>
				{t('oauth.prompt')}
			</div>
			<div className={'grid grid-cols-3 gap-4 w-fit mx-auto'}>
				{OAUTH_PROVIDER_IDS.map((provider) => {
					const config = OAUTH_PROVIDER_CONFIGS[provider];
					const href = buildLoginOAuthStartHref(provider, from);
					const visualConfig = OAUTH_PROVIDER_BUTTON_CONFIGS.find(
						({ provider: configProvider }) => configProvider === provider
					);
					if (!visualConfig) {
						return null;
					}
					const label = `${t(`oauth.providers.${config.id}`)} ${t('oauth.cta')}`;
					const buttonBackgroundColor = isDarkTheme
						? (visualConfig.button.darkBackgroundColor ??
							visualConfig.button.backgroundColor)
						: visualConfig.button.backgroundColor;
					const iconSrc =
						isDarkTheme && visualConfig.icon.darkSrc
							? visualConfig.icon.darkSrc
							: visualConfig.icon.src;
					const iconSize = visualConfig.button.kind === 'circle' ? 22 : 32;

					return (
						<Link
							key={provider}
							href={href}
							aria-label={label}
							title={label}
							className={
								'inline-flex size-8 items-center justify-center rounded-full transition-transform duration-150 hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
							}
						>
							{visualConfig.button.kind === 'circle' ? (
								<span
									className={
										'inline-flex size-8 items-center justify-center rounded-full'
									}
									style={
										buttonBackgroundColor
											? { backgroundColor: buttonBackgroundColor }
											: undefined
									}
								>
									<Image
										src={iconSrc}
										alt={''}
										width={iconSize}
										height={iconSize}
										aria-hidden={true}
									/>
								</span>
							) : (
								<Image
									src={iconSrc}
									alt={''}
									width={iconSize}
									height={iconSize}
									aria-hidden={true}
								/>
							)}
						</Link>
					);
				})}
			</div>
		</div>
	);
};

export default OAuthProviderButtons;
