/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/22
 *
 * Console view shown when the user is authenticated.
 * Displays a large greeting and feature cards.
 *
 * m5 fix: Greeting key is computed in useEffect after mount to avoid
 * SSR/client hydration mismatch (server and client may have different
 * timezones / clock values).
 */
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MeResponse } from '@/services/sso/api';

interface ConsoleViewProps {
	me: MeResponse;
}

const getGreetingKey = (): string => {
	const hour = new Date().getHours();
	if (hour >= 0 && hour < 5) return 'lateNight';
	if (hour >= 5 && hour < 8) return 'dawn';
	if (hour >= 8 && hour < 12) return 'morning';
	if (hour >= 12 && hour < 14) return 'noon';
	if (hour >= 14 && hour < 18) return 'afternoon';
	if (hour >= 18 && hour < 24) return 'evening';
	return 'default';
};

const ConsoleView = ({ me }: ConsoleViewProps) => {
	const t = useTranslations('console');
	const router = useRouter();

	// m5: Compute greeting after mount to avoid hydration mismatch
	const [greetingKey, setGreetingKey] = useState('default');

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- must run after hydration
		setGreetingKey(getGreetingKey());
	}, []);

	return (
		<>
			<h1 className={'text-2xl font-bold text-foreground'}>
				{t(`greeting.${greetingKey}`, { name: me.nickname ?? me.user_id })}
			</h1>

			<section
				className={
					'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full'
				}
			>
				{/* API Key Management card */}
				<button
					type={'button'}
					onClick={() => router.push('/console/tokens')}
					className={
						'flex flex-col items-center gap-3 py-6 px-4 rounded-[12px] ' +
						'bg-default hover:bg-default-hover transition-colors cursor-pointer text-left'
					}
				>
					<span
						className={
							'material-icons-round text-foreground text-[48px]! leading-none!'
						}
						aria-hidden={true}
					>
						key
					</span>
					<span className={'text-sm font-medium text-foreground'}>
						{t('card.apikey.title')}
					</span>
					<span className={'text-xs text-muted text-center'}>
						{t('card.apikey.subtitle')}
					</span>
				</button>
			</section>
		</>
	);
};

export default ConsoleView;
