/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/25 10:51:37
 *
 * Client-side login page. Handles QR, passkey, and mobile app login.
 * After successful login, redirects to the URL specified in the
 * `from` prop (set by SSR page.tsx).
 *
 * OAuth2 state is NOT generated here — it is created on-demand by the
 * setLoginCookies server action when the user taps the mobile app
 * login button.
 */
'use client';

import { useSetAtom, useAtomValue } from 'jotai';
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

const LoginPage = ({ from, error }: LoginPageProps) => {
	const setMobile = useSetAtom(mobileAtom);
	const setLoginSucceeded = useSetAtom(loginSucceededAtom);
	const loginSucceeded = useAtomValue(loginSucceededAtom);

	useEffect(() => {
		setMobile(isMobile(navigator.userAgent));
	}, [setMobile]);

	// Show toast when redirected back with an error from OAuth callback
	useEffect(() => {
		if (error) {
			toast.error(error);
		}
	}, [error]);

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
