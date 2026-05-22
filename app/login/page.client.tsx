/**
 * @author Claude
 * @version 3.5
 * @date 2026/5/22
 *
 * Client-side login page. Handles QR, passkey, and mobile app login.
 * After successful login, redirects to the URL specified in the
 * `from` prop (set by SSR page.tsx).
 *
 * C1 fix: OAuth2 state and HttpOnly cookies are set in SSR page.tsx.
 * State and from are passed as props — no client-side fetch needed.
 * Login success is a simple boolean signal — no redundant me() call.
 */
'use client';

import { useSetAtom, useAtomValue } from 'jotai';
import { useEffect } from 'react';

import LoginView from '@/app/login/LoginView';
import { loginSucceededAtom, mobileAtom, stateAtom } from '@/app/login/store';
import PageFrame from '@/components/layout/PageFrame';
import { isMobile } from '@/services/sso/ua';

interface LoginPageProps {
	initialState: string;
	from: string;
}

const LoginPage = ({ initialState, from }: LoginPageProps) => {
	const setMobile = useSetAtom(mobileAtom);
	const setState = useSetAtom(stateAtom);
	const setLoginSucceeded = useSetAtom(loginSucceededAtom);
	const loginSucceeded = useAtomValue(loginSucceededAtom);

	useEffect(() => {
		setState(initialState);
		setMobile(isMobile(navigator.userAgent));
	}, [initialState, setState, setMobile]);

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
				onLoginSucceeded={() => setLoginSucceeded(true)}
			/>
		</PageFrame>
	);
};

export default LoginPage;
