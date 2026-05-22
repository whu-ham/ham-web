/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * Single token card displaying name, last4, scopes, timestamps,
 * and rotate/revoke actions.
 */
'use client';

import { Button, Popover, Tooltip } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import type { TokenListItem } from '@/services/token/api';

interface TokenCardProps {
	token: TokenListItem;
	onRotate: () => void;
	onRevoke: () => void;
}

const formatDate = (iso: string, locale: string): string => {
	try {
		const date = new Date(iso);
		if (isNaN(date.getTime())) return '-';
		return date.toLocaleDateString(locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	} catch {
		return '-';
	}
};

const TokenCard = ({ token, onRotate, onRevoke }: TokenCardProps) => {
	const t = useTranslations('apikey');
	const tc = useTranslations('common');
	const locale = useLocale();
	const [revokeOpen, setRevokeOpen] = useState(false);

	return (
		<div className={'flex flex-col gap-3 rounded-[12px] bg-default p-4 w-full'}>
			<div className={'flex items-start justify-between'}>
				<div className={'flex flex-col min-w-0 gap-0.5'}>
					<span className={'text-sm font-medium text-foreground truncate'}>
						{token.name}
					</span>
					<span className={'font-mono text-xs text-muted'}>
						****{token.last4}
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
					<Popover isOpen={revokeOpen} onOpenChange={setRevokeOpen}>
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
									<Button
										variant={'tertiary'}
										size={'sm'}
										onPress={() => setRevokeOpen(false)}
									>
										{tc('cancel')}
									</Button>
									<Button
										variant={'danger'}
										size={'sm'}
										onPress={() => {
											setRevokeOpen(false);
											onRevoke();
										}}
									>
										{t('card.revoke')}
									</Button>
								</div>
							</div>
						</Popover.Content>
					</Popover>
				</div>
			</div>

			<div className={'flex flex-col gap-0.5'}>
				{token.scopes.map((scope) => (
					<span key={scope} className={'text-xs font-mono text-muted'}>
						{scope}
					</span>
				))}
			</div>

			<div className={'flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted'}>
				<span>
					{t('card.createdAt')} {formatDate(token.created_at, locale)}
				</span>
				<span>
					{t('card.expiresAt')} {formatDate(token.expires_at, locale)}
				</span>
				<span>
					{token.last_used_at
						? `${t('card.lastUsedAt')} ${formatDate(token.last_used_at, locale)}`
						: t('card.neverUsed')}
				</span>
			</div>
		</div>
	);
};

export default TokenCard;
