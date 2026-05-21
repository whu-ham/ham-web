/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/22
 *
 * Client-side orchestrator for /console.
 *
 * Flow:
 *   1. On mount, check URL for `code` + `state` (App callback).
 *   2. If App callback present, exchange code for session.
 *   3. Otherwise call WebAuthApi.me() to check session.
 *   4. 401 → show login view (reuses generic LoginView component).
 *   5. Authenticated → show ConsoleView with user info + feature cards.
 *   6. On mobile, provide "Open App" login option via deep link.
 */
'use client';

import { useAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';

import ConsoleView from '@/app/console/ConsoleView';
import { consoleStageAtom } from '@/app/console/store';
import HeaderBar from '@/components/HeaderBar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LoginView from '@/components/LoginView';
import PageFrame from '@/components/PageFrame';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import UserMenu from '@/components/UserMenu';
import { ApiError, WebAuthApi } from '@/services/sso/api';
import {
	buildSsoAuthorizeDeepLink,
	tryLaunchDeepLink,
} from '@/services/sso/deepLink';
import { isMobile } from '@/services/sso/ua';

const APP_CALLBACK_STATE_KEY = 'console_login_state';

const generateState = (): string => {
	const arr = new Uint8Array(16);
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		crypto.getRandomValues(arr);
	}
	return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

const ConsolePage = () => {
	const [stage, setStage] = useAtom(consoleStageAtom);
	const t = useTranslations('console');
	const callbackProcessedRef = useRef(false);

	const mobile = useMemo(() => {
		if (typeof navigator === 'undefined') return false;
		return isMobile(navigator.userAgent);
	}, []);

	const processAppCallback = useCallback(async () => {
		if (typeof window === 'undefined') return false;
		const usp = new URLSearchParams(window.location.search);
		const code = usp.get('code');
		const state = usp.get('state');
		if (!code || !state) return false;

		// Verify state matches what we stored
		const savedState = sessionStorage.getItem(APP_CALLBACK_STATE_KEY);
		sessionStorage.removeItem(APP_CALLBACK_STATE_KEY);
		if (state !== savedState) {
			toast.error(t('login.appCallbackFailed'));
			return false;
		}

		try {
			await WebAuthApi.appCallback(code);
		} catch {
			toast.error(t('login.appCallbackFailed'));
			return false;
		}

		// Clean URL — remove code & state params
		const cleanUrl = new URL(window.location.href);
		cleanUrl.searchParams.delete('code');
		cleanUrl.searchParams.delete('state');
		window.history.replaceState({}, '', cleanUrl.toString());

		// Now fetch user info
		try {
			const me = await WebAuthApi.me();
			setStage({ kind: 'console', me });
			return true;
		} catch {
			setStage({ kind: 'login' });
			return true; // callback was processed, even if me() failed
		}
	}, [setStage, t]);

	const probeLogin = useCallback(async () => {
		try {
			const me = await WebAuthApi.me();
			setStage({ kind: 'console', me });
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				setStage({ kind: 'login' });
				return;
			}
			// Other errors — treat as not-logged-in
			setStage({ kind: 'login' });
		}
	}, [setStage]);

	useEffect(() => {
		if (callbackProcessedRef.current) return;
		callbackProcessedRef.current = true;

		processAppCallback().then((processed) => {
			if (!processed) {
				probeLogin();
			}
		});
	}, [processAppCallback, probeLogin]);

	const handleOpenApp = useCallback(() => {
		const state = generateState();
		sessionStorage.setItem(APP_CALLBACK_STATE_KEY, state);

		const redirectUrl = window.location.origin + window.location.pathname;
		const deepLinkUrl = buildSsoAuthorizeDeepLink({
			appId: process.env.NEXT_PUBLIC_CONSOLE_CLIENT_ID ?? '',
			scope: [],
			state,
			redirectUri: redirectUrl,
		});

		tryLaunchDeepLink({ url: deepLinkUrl });
	}, []);

	const handleLogout = useCallback(async () => {
		try {
			await WebAuthApi.logout();
		} finally {
			setStage({ kind: 'login' });
		}
	}, [setStage]);

	if (stage.kind === 'loading') {
		return <div className={'min-h-screen'} />;
	}

	if (stage.kind === 'login') {
		return (
			<PageFrame key='login'>
				<LoginView
					onLoggedIn={(me) => setStage({ kind: 'console', me })}
					onLoginFailed={() => setStage({ kind: 'login' })}
					namespace='console'
					onOpenApp={mobile ? handleOpenApp : undefined}
				/>
			</PageFrame>
		);
	}

	// stage.kind === 'console'
	return (
		<div key='console' className={'min-h-screen w-full bg-surface'}>
			{/* Page header with integrated toolbar */}
			<header
				className={
					'sticky top-0 z-40 bg-surface/60 backdrop-blur-md border-b border-border/40'
				}
			>
				<div
					className={
						'mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between'
					}
				>
					<div className={'flex items-center gap-2.5 min-w-0'}>
						<img
							src={'/icon.png'}
							alt={''}
							className={'w-8 h-8 rounded-lg shrink-0'}
						/>
						<span
							className={
								'text-base font-bold text-foreground tracking-tight'
							}
						>
							Ham Console
						</span>
					</div>
					<div className={'flex items-center gap-1'}>
						<div className={'hidden sm:flex items-center gap-1'}>
							<ThemeSwitcher />
							<LanguageSwitcher />
						</div>
						<div className={'sm:hidden'}>
							<UserMenu onLogout={handleLogout} compact />
						</div>
						<div className={'hidden sm:block'}>
							<UserMenu onLogout={handleLogout} />
						</div>
					</div>
				</div>
			</header>

			{/* Content */}
			<div
				className={
					'mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6'
				}
			>
				<ConsoleView me={stage.me} />
			</div>
		</div>
	);
};

export default ConsolePage;
