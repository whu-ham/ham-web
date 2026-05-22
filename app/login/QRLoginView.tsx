/**
 * @author Claude
 * @version 5.0
 * @date 2026/5/22
 *
 * Generic QR login view for the /login page.
 * Rendering-only — all logic lives in useQrLogin.
 */

'use client';

import { Avatar } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';

import { useQrLogin } from '@/app/login/useQrLogin';

interface QRLoginViewProps {
	onLoginFailed?: () => void;
}

const QRLoginView = ({ onLoginFailed }: QRLoginViewProps) => {
	const t = useTranslations('sso.qr');
	const {
		ticket,
		check,
		creating,
		createFailed,
		refreshing,
		refresh,
		isExpired,
		isConfirmed,
		isScanned,
	} = useQrLogin(onLoginFailed);

	return (
		<div className={'flex flex-col items-center gap-4'}>
			<div className={'text-sm text-muted'}>{t('tip')}</div>

			<div
				className={
					'h-[160px] flex items-center justify-center relative rounded-[12px]'
				}
			>
				{createFailed && (
					<button
						type={'button'}
						onClick={refresh}
						disabled={creating}
						aria-label={t('refresh')}
						className={
							'flex flex-col items-center justify-center gap-2 size-[160px] rounded-[12px] bg-default hover:bg-default-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors'
						}
					>
						<span
							className={
								'material-icons-round text-muted text-[40px]! leading-none!'
							}
							aria-hidden={true}
						>
							refresh
						</span>
						<span className={'text-xs text-muted'}>{t('refresh')}</span>
					</button>
				)}

				{!createFailed &&
					!isExpired &&
					!isConfirmed &&
					!isScanned &&
					!refreshing && (
						<div
							className={
								'size-[160px] flex items-center justify-center rounded-[12px] bg-white border border-border'
							}
						>
							{ticket && (
								<QRCodeSVG
									value={`ham://qrcode-login?ticket=${ticket}`}
									size={144}
								/>
							)}
						</div>
					)}

				{!createFailed && isScanned && (
					<div className={'flex flex-col items-center gap-2'}>
						<Avatar>
							{check?.scan_user_info?.avatar_url ? (
								<Avatar.Image
									src={check.scan_user_info.avatar_url}
									alt={check.scan_user_info.nickname ?? ''}
								/>
							) : null}
							<Avatar.Fallback>
								{(check?.scan_user_info?.nickname ?? '?').slice(0, 1)}
							</Avatar.Fallback>
						</Avatar>
						<div
							className={
								'max-w-[140px] text-center text-sm font-semibold truncate'
							}
						>
							{check?.scan_user_info?.nickname ?? ''}
						</div>
						<div className={'text-xs text-muted text-center'}>
							{t('scanned')}
						</div>
					</div>
				)}

				{!createFailed && isConfirmed && (
					<div className={'flex flex-col items-center gap-2'}>
						<div
							className={
								'size-12 rounded-full bg-accent flex items-center justify-center'
							}
						>
							<span
								className={
									'material-icons-round text-accent-foreground text-3xl!'
								}
							>
								done
							</span>
						</div>
						<div className={'text-sm text-foreground text-center'}>
							{t('loginSuccess')}
						</div>
					</div>
				)}

				{!createFailed && isExpired && (
					<button
						type={'button'}
						onClick={refresh}
						disabled={creating}
						aria-label={t('refresh')}
						className={
							'flex flex-col items-center justify-center gap-2 size-[160px] rounded-[12px] bg-default hover:bg-default-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors'
						}
					>
						<span
							className={
								'material-icons-round text-muted text-[40px]! leading-none!'
							}
							aria-hidden={true}
						>
							refresh
						</span>
						<span className={'text-xs text-muted'}>{t('expired')}</span>
					</button>
				)}
			</div>
		</div>
	);
};

export default QRLoginView;
