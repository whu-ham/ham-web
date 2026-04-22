/**
 * @author Claude
 * @version 1.3
 * @date 2026/4/21 19:16:19
 */
'use client';

import { useTranslations } from 'next-intl';

const InvalidRequestView = () => {
	const t = useTranslations('sso');
	return (
		<div className={'flex flex-col items-center text-center gap-4'}>
			<div className={'text-5xl'}>⚠️</div>
			<h1 className={'text-xl font-bold text-foreground'}>
				{t('invalid.title')}
			</h1>
			<p className={'text-sm text-muted'}>{t('invalid.description')}</p>
		</div>
	);
};

export default InvalidRequestView;
