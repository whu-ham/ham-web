/**
 * @author Claude
 * @version 2.0
 * @date 2026/9/23 01:53:07
 *
 * Client-side login page. Handles QR, passkey, and mobile app login.
 * After successful login, redirects to the URL specified in the
 * `from` prop (set by SSR page.tsx).
 *
 * OAuth2 state is NOT generated here — it is created on-demand by the
 * setLoginCookies server action when the user taps the mobile app
 * login button.
 *
 * r6 fix: the `error` query value is a code, not a message. The callback
 * redirect used to carry the backend's text (or an exception message)
 * straight into a toast, which is how a missing-env diagnostic would end
 * up on screen.
 */
'use client';

import { useSetAtom, useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

import LoginView from '@/app/login/LoginView';
import { loginSucceededAtom, mobileAtom } from '@/app/login/store';
import PageFrame from '@/components/layout/PageFrame';
import { isMobile } from '@/services/sso/ua';

interface LoginPageProps {
	from: string;
	error?: string;
}

/**
 * Failure codes the login callbacks redirect with, mapped to the message
 * the user sees. Anything not listed here falls back to the generic
 * failure copy rather than being echoed verbatim.
 */
const ERROR_MESSAGE_KEYS: Record<string, string> = {
	missing_code_or_state: 'login.errors.invalidState',
	state_cookie_missing: 'login.errors.invalidState',
	state_mismatch: 'login.errors.invalidState',
	invalid_state: 'login.errors.invalidState',
	unsupported_provider: 'login.errors.unsupportedProvider',
	missing_payload: 'login.errors.missingPayload',
	app_callback_failed: 'login.appCallbackFailed',
	oauth_failed: 'login.errors.oauthFailed',
};

const LoginPage = ({ from, error }: LoginPageProps) => {
	const t = useTranslations('console');
	const setMobile = useSetAtom(mobileAtom);
	const setLoginSucceeded = useSetAtom(loginSucceededAtom);
	const loginSucceeded = useAtomValue(loginSucceededAtom);

	useEffect(() => {
		setMobile(isMobile(navigator.userAgent));
	}, [setMobile]);

	// Show toast when redirected back with an error from OAuth callback
	useEffect(() => {
		if (error) {
			toast.error(t(ERROR_MESSAGE_KEYS[error] ?? 'login.errors.unknown'));
		}
	}, [error, t]);

	// Redirect when login succeeds — session cookie is already set by backend
	useEffect(() => {
		if (loginSucceeded && from) {
			window.location.href = from;
		}
	}, [loginSucceeded, from]);

	return (
		<PageFrame>
			<LoginView
				namespace='console'
				from={from}
				onLoginSucceeded={() => setLoginSucceeded(true)}
			/>
		</PageFrame>
	);
};

export default LoginPage;
