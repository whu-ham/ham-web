/**
 * Shared browser OAuth provider entry list for login surfaces.
 */

'use client';

import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';

import {
	buildLoginOAuthStartHref,
	OAUTH_PROVIDER_CONFIGS,
	OAUTH_PROVIDER_IDS,
} from '@/services/oauth-providers';

interface OAuthProviderButtonsProps {
	from: string;
	namespace: 'console' | 'sso';
}

const OAuthProviderButtons = ({
	from,
	namespace,
}: OAuthProviderButtonsProps) => {
	const t = useTranslations(namespace);

	return (
		<div className={'w-full flex flex-col gap-3'}>
			<div className={'text-sm text-muted text-center'}>
				{t('login.oauth.prompt')}
			</div>
			<div className={'grid grid-cols-1 sm:grid-cols-2 gap-3 w-full'}>
				{OAUTH_PROVIDER_IDS.map((provider) => {
					const config = OAUTH_PROVIDER_CONFIGS[provider];
					const href = buildLoginOAuthStartHref(provider, from);

					return (
						<a key={provider} href={href} className={'contents'}>
							<Button
								variant={'outline'}
								className={
									'w-full min-h-[56px] justify-start gap-3 rounded-[14px] border-border/70 bg-background/80 px-4 py-3'
								}
							>
								<span
									className={`size-3 rounded-full ${config.accentClassName}`}
									aria-hidden={true}
								/>
								<div className={'flex flex-col items-start leading-tight'}>
									<span className={'font-semibold text-foreground'}>
										{t(`login.oauth.providers.${config.id}`)}
									</span>
									<span className={'text-xs text-muted'}>
										{t('login.oauth.cta')}
									</span>
								</div>
							</Button>
						</a>
					);
				})}
			</div>
		</div>
	);
};

export default OAuthProviderButtons;
