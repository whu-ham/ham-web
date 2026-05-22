/**
 * @author Claude
 * @version 2.0
 * @date 2026/5/22
 *
 * Console page client component. Rendering-only — logout logic in useLogout.
 */

'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';

import ConsoleView from '@/app/console/ConsoleView';
import LanguageSwitcher from '@/components/preferences/LanguageSwitcher';
import ThemeSwitcher from '@/components/preferences/ThemeSwitcher';
import UserMenu from '@/components/preferences/UserMenu';
import { MeResponse } from '@/services/sso/api';

interface ConsolePageProps {
	me: MeResponse;
}

const ConsolePage = ({ me }: ConsolePageProps) => {
	const t = useTranslations('console');

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
							<UserMenu compact />
						</div>
						<div className={'hidden sm:block'}>
							<UserMenu />
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
