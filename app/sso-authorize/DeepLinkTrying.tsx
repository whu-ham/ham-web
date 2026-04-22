/**
 * @author Claude
 * @version 1.6
 * @date 2026/4/21 19:07:21
 *
 * Intermediate mobile screen shown while we auto-attempt `ham://` and
 * wait to see whether the OS hands the user off to the native App.
 *
 * Layout:
 *   - Title + description + spinner ("Continuing in Ham…").
 *   - A manual "Open Ham" button that re-fires the deep link. If the
 *     manual attempt itself throws synchronously or times out, the
 *     parent bumps us to the "app not installed" screen.
 *
 * Reads `deepLinkUrlAtom` directly — no props needed.
 */
'use client';

import { Link, Spinner } from '@heroui/react';
import { useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';

import { deepLinkUrlAtom } from '@/app/sso-authorize/store';

const DeepLinkTrying = () => {
	const t = useTranslations('sso.deepLink.trying');
	const deepLinkUrl = useAtomValue(deepLinkUrlAtom);

	return (
		<>
			<Spinner size={'lg'} className={'self-center'} />
			<div className={'flex flex-col gap-2 text-center'}>
				<h1 className={'text-xl font-bold text-foreground'}>{t('title')}</h1>
				<p className={'text-sm text-muted'}>{t('description')}</p>
			</div>
			<Link href={deepLinkUrl} className={'w-full flex justify-center'}>
				{t('openApp')}
			</Link>
		</>
	);
};

export default DeepLinkTrying;
