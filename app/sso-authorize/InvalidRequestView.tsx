/**
 * @author Codex
 * @version 1.0
 * @date 2026/4/20
 */
'use client';

import { useTranslations } from 'next-intl';

import HeaderBar from '@/app/sso-authorize/HeaderBar';

const InvalidRequestView = () => {
	const t = useTranslations('sso');
	return (
		<div
			className={
				'min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-default px-4 py-16'
			}
		>
			<HeaderBar />
			<div
				className={
					'bg-surface rounded-[16px] p-8 max-w-md w-full flex flex-col gap-4 items-center text-center'
				}
			>
				<div className={'text-5xl'}>⚠️</div>
				<h1 className={'text-xl font-bold text-foreground'}>
					{t('invalid.title')}
				</h1>
				<p className={'text-sm text-muted'}>{t('invalid.description')}</p>
			</div>
		</div>
	);
};

export default InvalidRequestView;
