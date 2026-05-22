/**
 * @author Claude
 * @version 1.3
 * @date 2026/5/22
 *
 * Client-side page for /console/tokens — Token management.
 * Lists all tokens, with create/rotate/revoke actions.
 */
'use client';

import { Button, Spinner } from '@heroui/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import CreateTokenModal from '@/app/console/tokens/CreateTokenModal';
import RotateTokenModal from '@/app/console/tokens/RotateTokenModal';
import TokenCard from '@/app/console/tokens/TokenCard';
import TokenRevealModal from '@/app/console/tokens/TokenRevealModal';
import {
	createModalVisibleAtom,
	newlyCreatedTokenAtom,
	rotateModalAtom,
	tokenListAtom,
	tokenListLoadingAtom,
} from '@/app/console/tokens/store';
import LanguageSwitcher from '@/components/preferences/LanguageSwitcher';
import ThemeSwitcher from '@/components/preferences/ThemeSwitcher';
import UserMenu from '@/components/preferences/UserMenu';
import type { TokenListItem } from '@/services/token/api';
import { TokenApi } from '@/services/token/api';
import { WebAuthApi } from '@/services/sso/api';
import { useRouter } from 'next/navigation';

interface TokensPageProps {
	initialTokens?: TokenListItem[];
}

const TokensPage = ({ initialTokens }: TokensPageProps) => {
	// Hydrate atoms with SSR data before first render — no loading flash
	useHydrateAtoms([
		[tokenListAtom, initialTokens ?? []],
		[tokenListLoadingAtom, !initialTokens],
	]);

	const t = useTranslations('apikey');
	const router = useRouter();
	const [tokens, setTokens] = useAtom(tokenListAtom);
	const [loading, setLoading] = useAtom(tokenListLoadingAtom);
	const setCreateModalVisible = useSetAtom(createModalVisibleAtom);
	const setRotateModal = useSetAtom(rotateModalAtom);
	const newlyCreated = useAtomValue(newlyCreatedTokenAtom);
	const [hydrated, setHydrated] = useState(false);

	const fetchTokens = useCallback(async () => {
		setLoading(true);
		try {
			const resp = await TokenApi.list();
			setTokens(resp.tokens);
		} catch {
			toast.error(t('error.fetchFailed'));
		} finally {
			setLoading(false);
		}
	}, [setTokens, setLoading, t]);

	// If no SSR data, fetch on mount
	useEffect(() => {
		if (!initialTokens) {
			fetchTokens();
		}
		setHydrated(true);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Refresh list when a new token is created/rotated (after hydration)
	useEffect(() => {
		if (hydrated && newlyCreated) {
			fetchTokens();
		}
	}, [newlyCreated, fetchTokens, hydrated]);

	const handleRevoke = useCallback(
		async (id: string) => {
			try {
				await TokenApi.revoke(id);
				setTokens((prev) => prev.filter((tk) => tk.id !== id));
			} catch {
				toast.error(t('error.revokeFailed'));
			}
		},
		[setTokens, t]
	);

	const handleRotate = useCallback(
		(id: string) => {
			setRotateModal({ visible: true, tokenId: id });
		},
		[setRotateModal]
	);

	const handleLogout = useCallback(async () => {
		try {
			await WebAuthApi.logout();
		} finally {
			const from = encodeURIComponent('/console/tokens');
			router.push(`/login?from=${from}`);
		}
	}, [router]);

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
