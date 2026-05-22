/**
 * @author Claude
 * @version 1.3
 * @date 2026/5/22
 *
 * Console page client component. Receives authenticated user data
 * from SSR and renders the console view.
 */
'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import ConsoleView from '@/app/console/ConsoleView';
import LanguageSwitcher from '@/components/preferences/LanguageSwitcher';
import ThemeSwitcher from '@/components/preferences/ThemeSwitcher';
import UserMenu from '@/components/preferences/UserMenu';
import { MeResponse, WebAuthApi } from '@/services/sso/api';

interface ConsolePageProps {
	me: MeResponse;
}

const ConsolePage = ({ me }: ConsolePageProps) => {
	const t = useTranslations('console');
	const router = useRouter();

	const handleLogout = useCallback(async () => {
		try {
			await WebAuthApi.logout();
		} finally {
			const from = encodeURIComponent(`${window.location.origin}/console`);
			router.push(`/login?from=${from}`);
		}
	}, [router]);

	return (
		<div className={'min-h-screen w-full bg-surface'}>
			{/* Page header with integrated toolbar */}
			<header
				className={
					'sticky top-0 z-40 bg-surface/60 backdrop-blur-md border-b border-border/40'
				}
			>
				<div
					className={
						'mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between'
					}
				>
					<div className={'flex items-center gap-2.5 min-w-0'}>
						<Image
							src={'/icon-1024.png'}
							alt={''}
							width={32}
							height={32}
							className={'w-8 h-8 rounded-[20%] shrink-0'}
						/>
						<span
							className={'text-base font-bold text-foreground tracking-tight'}
						>
							{t('header.title')}
						</span>
					</div>
					<div className={'flex items-center gap-1'}>
						<div className={'hidden sm:flex items-center gap-1'}>
							<ThemeSwitcher />
							<LanguageSwitcher />
						</div>
						<div className={'sm:hidden'}>
							<UserMenu onLogout={handleLogout} compact />
						</div>
						<div className={'hidden sm:block'}>
							<UserMenu onLogout={handleLogout} />
						</div>
					</div>
				</div>
			</header>

			{/* Content */}
			<div
				className={
					'mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6'
				}
			>
				<ConsoleView me={me} />
			</div>
		</div>
	);
};

export default ConsolePage;
