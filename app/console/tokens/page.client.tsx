/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * Client-side page for /console/tokens — Token management.
 * Lists all tokens, with create/rotate/revoke actions.
 */
'use client';

import { Button, Spinner } from '@heroui/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
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
import PageFrame from '@/components/PageFrame';
import type { TokenListItem } from '@/services/token/api';
import { TokenApi } from '@/services/token/api';
import { useRouter } from 'next/navigation';

interface TokensPageProps {
	initialTokens?: TokenListItem[];
}

const TokensPage = ({ initialTokens }: TokensPageProps) => {
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

	// Use SSR data on first render, then hydrate
	useEffect(() => {
		if (initialTokens && initialTokens.length > 0) {
			setTokens(initialTokens);
			setLoading(false);
		} else {
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
				setTokens((prev) => prev.filter((t) => t.id !== id));
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

	return (
		<PageFrame maxWidth='max-w-2xl'>
			<header
				className={'flex flex-row items-center justify-between w-full min-w-0'}
			>
				<div className={'flex items-center gap-3 min-w-0'}>
					<Button
						variant={'tertiary'}
						size={'sm'}
						onPress={() => router.push('/console')}
					>
						<span
							className={'material-icons-round text-[18px]! leading-none!'}
							aria-hidden={true}
						>
							arrow_back
						</span>
					</Button>
					<h1 className={'text-lg font-bold text-foreground'}>{t('title')}</h1>
				</div>
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
			</header>

			<section className={'flex flex-col gap-3 w-full'}>
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
			</section>

			<CreateTokenModal />
			<RotateTokenModal />
			<TokenRevealModal />
		</PageFrame>
	);
};

export default TokensPage;
