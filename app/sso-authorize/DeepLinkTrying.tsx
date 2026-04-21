/**
 * @author Claude
 * @version 1.2
 * @date 2026/4/21 10:10:12
 *
 * Intermediate mobile screen shown while we auto-attempt `ham://` and
 * wait to see whether the OS hands the user off to the native App.
 *
 * Layout:
 *   - Title + description + spinner ("Continuing in Ham…").
 *   - A manual "Open Ham" button that re-fires the deep link. If the
 *     manual attempt itself throws synchronously or times out, the
 *     parent bumps us to the "app not installed" screen.
 */
'use client';

import { Link, Spinner } from '@heroui/react';
import { useTranslations } from 'next-intl';

import HeaderBar from '@/app/sso-authorize/HeaderBar';

interface DeepLinkTryingProps {
	/**
	 * The deep-link URL to open. Rendered as a plain anchor `<Link>`
	 * so the OS can handle the `ham://` scheme natively.
	 */
	deepLinkUrl: string;
}

const DeepLinkTrying = ({ deepLinkUrl }: DeepLinkTryingProps) => {
	const t = useTranslations('sso.deepLink.trying');

	return (
		<div
			className={
				'min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-default px-4 py-16'
			}
		>
			<HeaderBar />
			<div
				className={
					'bg-surface rounded-[16px] p-6 w-full max-w-md flex flex-col gap-6 items-center text-center'
				}
			>
				<Spinner size={'lg'} />
				<div className={'flex flex-col gap-2'}>
					<h1 className={'text-xl font-bold text-foreground'}>{t('title')}</h1>
					<p className={'text-sm text-muted'}>{t('description')}</p>
				</div>
			<Link href={deepLinkUrl} className={'w-full flex justify-center'}>
				{t('openApp')}
			</Link>
			</div>
		</div>
	);
};

export default DeepLinkTrying;
