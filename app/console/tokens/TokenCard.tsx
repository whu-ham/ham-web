/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * Single token card displaying name, last4, scopes, timestamps,
 * and rotate/revoke actions.
 */
'use client';

import { Button, Chip, Popover, Tooltip } from '@heroui/react';
import { useTranslations } from 'next-intl';

import type { TokenListItem } from '@/services/token/api';

interface TokenCardProps {
	token: TokenListItem;
	onRotate: () => void;
	onRevoke: () => void;
}

const formatDate = (iso: string): string => {
	try {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	} catch {
		return iso;
	}
};

const TokenCard = ({ token, onRotate, onRevoke }: TokenCardProps) => {
	const t = useTranslations('apikey');

	return (
		<div className={'flex flex-col gap-3 rounded-[12px] bg-default p-4 w-full'}>
			<div className={'flex items-center justify-between'}>
				<div className={'flex flex-col min-w-0'}>
					<span className={'text-sm font-medium text-foreground truncate'}>
						{token.name}
					</span>
					<span className={'text-xs text-muted'}>
						{t('card.last4', { last4: token.last4 })}
					</span>
				</div>
				<div className={'flex items-center gap-1 shrink-0'}>
					<Tooltip>
						<Tooltip.Trigger>
							<Button variant={'tertiary'} size={'sm'} onPress={onRotate}>
								<span
									className={'material-icons-round text-[18px]! leading-none!'}
									aria-hidden={true}
								>
									autorenew
								</span>
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>{t('card.rotate')}</Tooltip.Content>
					</Tooltip>
					<Popover>
						<Popover.Trigger>
							<Button variant={'danger-soft'} size={'sm'}>
								<span
									className={'material-icons-round text-[18px]! leading-none!'}
									aria-hidden={true}
								>
									delete_outline
								</span>
							</Button>
						</Popover.Trigger>
						<Popover.Content>
							<div className={'flex flex-col gap-3 p-4 max-w-65'}>
								<p className={'text-sm text-foreground'}>
									{t('card.revokeConfirm')}
								</p>
								<div className={'flex gap-2 justify-end'}>
									<Popover.Trigger>
										<Button variant={'tertiary'} size={'sm'}>
											{t('card.revoke')}
										</Button>
									</Popover.Trigger>
									<Button variant={'danger'} size={'sm'} onPress={onRevoke}>
										{t('card.revoke')}
									</Button>
								</div>
							</div>
						</Popover.Content>
					</Popover>
				</div>
			</div>

			<div className={'flex flex-wrap gap-1'}>
				{token.scopes.map((scope) => (
					<Chip key={scope} size={'sm'} variant={'tertiary'}>
						{scope}
					</Chip>
				))}
			</div>

			<div className={'text-xs text-muted'}>
				{t('card.createdAt')} {formatDate(token.created_at)} ·{' '}
				{t('card.expiresAt')} {formatDate(token.expires_at)}
				{token.last_used_at
					? ` · ${t('card.lastUsedAt')} ${formatDate(token.last_used_at)}`
					: ` · ${t('card.neverUsed')}`}
			</div>
		</div>
	);
};

export default TokenCard;
