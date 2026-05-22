/**
 * @author Claude
 * @version 2.1
 * @date 2026/5/22
 *
 * Client-side page for /console/tokens — Token management.
 * Rendering-only — list logic in useTokenList, logout in useLogout.
 *
 * M1 fix: Handles null initialTokens (SSR fetch failed) by entering
 * loading state and letting client-side fetch recover.
 *
 * m8 fix: Shows a retry button in the empty state when fetchError is true.
 */
'use client';

import { Button, Spinner } from '@heroui/react';
import { useHydrateAtoms } from 'jotai/utils';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import CreateTokenModal from '@/app/console/tokens/CreateTokenModal';
import RotateTokenModal from '@/app/console/tokens/RotateTokenModal';
import TokenCard from '@/app/console/tokens/TokenCard';
import TokenRevealModal from '@/app/console/tokens/TokenRevealModal';
import {
	tokenListAtom,
	tokenListErrorAtom,
	tokenListLoadingAtom,
} from '@/app/console/tokens/store';
import { useTokenList } from '@/app/console/tokens/useTokenList';
import LanguageSwitcher from '@/components/preferences/LanguageSwitcher';
import ThemeSwitcher from '@/components/preferences/ThemeSwitcher';
import UserMenu from '@/components/preferences/UserMenu';
import type { TokenListItem } from '@/services/token/api';

interface TokensPageProps {
	initialTokens?: TokenListItem[] | null;
}

const TokensPage = ({ initialTokens }: TokensPageProps) => {
	// M1: null initialTokens means SSR failed — enter loading state
	useHydrateAtoms([
		[tokenListAtom, initialTokens ?? []],
		[tokenListLoadingAtom, !initialTokens],
		[tokenListErrorAtom, false],
	]);

	const t = useTranslations('apikey');
	const router = useRouter();
	const {
		tokens,
		loading,
		fetchError,
		fetchTokens,
		handleRevoke,
		handleRotate,
		setCreateModalVisible,
	} = useTokenList(initialTokens);

	return (
		<div className={'min-h-screen w-full bg-surface'}>
			{/* Sticky page header with integrated toolbar */}
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
					<div className={'flex items-center gap-3 min-w-0'}>
						<Button
							variant={'tertiary'}
							size={'sm'}
							isIconOnly
							onPress={() => router.push('/console')}
							aria-label={t('backToConsole')}
						>
							<span
								className={'material-icons-round text-[18px]! leading-none!'}
								aria-hidden={true}
							>
								arrow_back
							</span>
						</Button>
						<h1 className={'text-lg font-bold text-foreground'}>
							{t('title')}
						</h1>
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
					'mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-3'
				}
			>
				{/* Create button above the list */}
				{!loading && tokens.length > 0 && (
					<div className={'flex justify-end'}>
						<Button
							variant={'primary'}
							size={'sm'}
							onPress={() => setCreateModalVisible(true)}
						>
							<span
								className={'material-icons-round text-[18px]! leading-none!'}
								aria-hidden={true}
							>
								add
							</span>
							{t('create')}
						</Button>
					</div>
				)}

				{loading && (
					<div className={'flex justify-center py-8'}>
						<Spinner size={'lg'} />
					</div>
				)}

				{!loading && tokens.length === 0 && (
					<div className={'flex flex-col items-center gap-2 py-8 text-center'}>
						<span
							className={
								'material-icons-round text-muted text-[48px]! leading-none!'
							}
							aria-hidden={true}
						>
							vpn_key
						</span>
						<h2 className={'text-base font-medium text-foreground'}>
							{t('empty.title')}
						</h2>
						<p className={'text-sm text-muted'}>{t('empty.description')}</p>
						{/* m8: Retry button when fetch failed */}
						{fetchError && (
							<Button
								variant={'tertiary'}
								size={'sm'}
								onPress={fetchTokens}
								className={'mt-2'}
							>
								<span
									className={'material-icons-round text-[18px]! leading-none!'}
									aria-hidden={true}
								>
									refresh
								</span>
								{t('error.retry')}
							</Button>
						)}
					</div>
				)}

				{!loading &&
					tokens.map((token) => (
						<TokenCard
							key={token.id}
							token={token}
							onRotate={() => handleRotate(token.id)}
							onRevoke={() => handleRevoke(token.id)}
						/>
					))}
			</div>

			<CreateTokenModal />
			<RotateTokenModal />
			<TokenRevealModal />
		</div>
	);
};

export default TokensPage;
