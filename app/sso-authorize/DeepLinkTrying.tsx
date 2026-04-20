/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/20
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

import { Button, Spinner } from '@heroui/react';
import { useTranslations } from 'next-intl';

import HeaderBar from '@/app/sso-authorize/HeaderBar';

interface DeepLinkTryingProps {
	/**
	 * Re-attempt the deep-link navigation. Driven by the orchestrator so
	 * the same timeout/failure rules apply to manual taps as to the
	 * initial auto-attempt.
	 */
	openApp: () => void;
	/**
	 * True while a manual attempt is in flight. We disable the button
	 * and swap the label to "Opening…" for visual feedback.
	 */
	opening: boolean;
}

const DeepLinkTrying = ({ openApp, opening }: DeepLinkTryingProps) => {
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
				<Button
					variant={'primary'}
					className={'w-full'}
					isPending={opening}
					onPress={openApp}
				>
					{opening ? t('opening') : t('openApp')}
				</Button>
			</div>
		</div>
	);
};

export default DeepLinkTrying;
