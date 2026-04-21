/**
 * @author Claude
 * @version 2.4
 * @date 2026/4/21 12:47:55
 *
 * Combined login surface for the /sso-authorize page. On desktop both
 * the QR code and the Passkey button are shown stacked, mirroring the
 * `/login` page layout: QR on top, a centered "or sign in with"
 * separator, and the Passkey CTA below. On the mobile Passkey
 * fallback path (showQR = false) we render the Passkey view alone in
 * its standalone form.
 */
'use client';

import { Separator } from '@heroui/react';
import { useTranslations } from 'next-intl';

import HeaderBar from '@/app/sso-authorize/HeaderBar';
import PasskeyLoginView from '@/app/sso-authorize/PasskeyLoginView';
import QRLoginView from '@/app/sso-authorize/QRLoginView';

interface LoginViewProps {
	showQR: boolean;
	onLoggedIn: () => void;
}

const LoginView = ({ showQR, onLoggedIn }: LoginViewProps) => {
	const t = useTranslations('sso');

	return (
		<div
			className={
				'min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-default px-4 md:px-12 lg:px-24 py-16'
			}
		>
			<HeaderBar />
			<div
				className={
					'bg-surface rounded-[16px] p-6 md:p-10 w-full max-w-xl min-w-0 flex flex-col gap-6'
				}
			>
				<header
					className={'flex flex-col md:flex-row items-center gap-4 md:gap-6'}
				>
					<div className={'flex flex-col items-center md:items-start'}>
						<h1 className={'text-xl font-bold text-foreground'}>
							{t('login.title')}
						</h1>
						<p className={'text-sm text-muted'}>{t('login.subtitle')}</p>
					</div>
				</header>

				<section className={'flex flex-col items-center gap-6'}>
					{showQR ? (
						<>
							<QRLoginView onLoggedIn={onLoggedIn} />
							{/*
							 * "Or sign in with" divider — matches the pattern used on
							 * the standalone /login page (app/login/components.tsx).
							 * The two short separators flanking the label keep the
							 * visual weight balanced without making the Passkey CTA
							 * look like an afterthought.
							 *
							 * We deliberately apply the width caps via `w-16` (not
							 * `max-w-16`) so the HeroUI Separator, which defaults to
							 * `shrink-0`, can't push the row wider than the viewport
							 * on narrow phones — that was the source of horizontal
							 * scroll previously. `shrink` re-enables flexbox shrinking
							 * as a belt-and-suspenders measure.
							 */}
							<div className={'w-full flex items-center justify-center gap-4'}>
								<Separator className={'w-16 shrink'} />
								<span className={'shrink-0 text-sm text-muted'}>
									{t('login.divider.other')}
								</span>
								<Separator className={'w-16 shrink'} />
							</div>
							<PasskeyLoginView onLoggedIn={onLoggedIn} compact />
						</>
					) : (
						<PasskeyLoginView onLoggedIn={onLoggedIn} />
					)}
				</section>
			</div>
		</div>
	);
};

export default LoginView;
