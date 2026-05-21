/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * Console view shown when the user is authenticated.
 * Displays a greeting, user avatar, logout button, and feature cards.
 */
'use client';

import { Avatar, Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { MeResponse, WebAuthApi } from '@/services/sso/api';

interface ConsoleViewProps {
	me: MeResponse;
	onLogout: () => void;
}

function getGreetingKey(): string {
	const hour = new Date().getHours();
	if (hour >= 0 && hour < 5) return 'lateNight';
	if (hour >= 5 && hour < 8) return 'dawn';
	if (hour >= 8 && hour < 12) return 'morning';
	if (hour >= 12 && hour < 14) return 'noon';
	if (hour >= 14 && hour < 18) return 'afternoon';
	if (hour >= 18 && hour < 24) return 'evening';
	return 'default';
}

const ConsoleView = ({ me, onLogout }: ConsoleViewProps) => {
	const t = useTranslations('console');
	const router = useRouter();

	const handleLogout = useCallback(async () => {
		try {
			await WebAuthApi.logout();
		} finally {
			onLogout();
		}
	}, [onLogout]);

	const greetingKey = getGreetingKey();

	return (
		<>
			<header className={'flex items-center justify-between w-full min-w-0'}>
				<div className={'flex items-center gap-3 min-w-0'}>
					<Avatar>
						{me.avatar_url ? (
							<Avatar.Image src={me.avatar_url} alt={me.nickname ?? ''} />
						) : null}
						<Avatar.Fallback>
							{(me.nickname ?? me.user_id ?? '?').slice(0, 1)}
						</Avatar.Fallback>
					</Avatar>
					<div className={'flex flex-col min-w-0'}>
						<span className={'text-sm text-muted'}>
							{t(`greeting.${greetingKey}`)}
						</span>
						<span
							className={'text-base font-semibold text-foreground truncate'}
						>
							{me.nickname ?? me.user_id}
						</span>
					</div>
				</div>
				<Button variant={'tertiary'} size={'sm'} onPress={handleLogout}>
					<span
						className={'material-icons-round !text-[18px] !leading-none'}
						aria-hidden={true}
					>
						logout
					</span>
					{t('logout')}
				</Button>
			</header>

			<section
				className={
					'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full'
				}
			>
				{/* API Key Management card */}
				<button
					type={'button'}
					onClick={() => router.push('/console/apikeys')}
					className={
						'flex flex-col items-center gap-3 py-6 px-4 rounded-[12px] ' +
						'bg-default hover:bg-default-hover transition-colors cursor-pointer text-left'
					}
				>
					<span
						className={
							'material-icons-round text-foreground !text-[48px] !leading-none'
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
