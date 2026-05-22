/**
 * @author Claude
 * @version 3.0
 * @date 2026/5/22
 *
 * Client-side login page. Handles QR, passkey, and mobile app login.
 * After successful login, redirects to the URL specified in the
 * `from` query parameter (defaults to /console).
 *
 * State management uses Jotai atoms defined in ./store.ts.
 * QRLoginView / PasskeyLoginView write to `loginMeAtom` on success;
 * this component watches it and performs the redirect.
 *
 * Before launching the app deep link, `from` is persisted to
 * sessionStorage so that /login/callback can redirect back after
 * the OAuth2 code exchange.
 */
'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import LoginView from '@/app/login/LoginView';
import {
	fromAtom,
	loginMeAtom,
	mobileAtom,
	stateAtom,
} from '@/app/login/store';
import PageFrame from '@/components/layout/PageFrame';
import { isMobile } from '@/services/sso/ua';
import { safeRedirect } from '@/services/redirect';

const SESSION_KEY_FROM = 'ham_login_from';
const SESSION_KEY_STATE = 'ham_login_state';

const generateState = (): string => {
	const arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

const LoginPage = () => {
	const searchParams = useSearchParams();
	const [from, setFrom] = useAtom(fromAtom);
	const setMobile = useSetAtom(mobileAtom);
	const setState = useSetAtom(stateAtom);
	const [loginMe] = useAtom(loginMeAtom);

	// Initialize atoms on mount
	useEffect(() => {
		const urlFrom = searchParams.get('from');
		const resolved = safeRedirect(urlFrom, `${window.location.origin}/console`);
		setFrom(resolved);
		setMobile(isMobile(navigator.userAgent));

		// Generate OAuth2 state for CSRF protection and persist it
		const state = generateState();
		setState(state);
		sessionStorage.setItem(SESSION_KEY_FROM, resolved);
		sessionStorage.setItem(SESSION_KEY_STATE, state);
	}, [searchParams, setFrom, setMobile, setState]);

	// Redirect when login succeeds
	useEffect(() => {
		if (loginMe && from) {
			sessionStorage.removeItem(SESSION_KEY_FROM);
			sessionStorage.removeItem(SESSION_KEY_STATE);
			window.location.href = from;
		}
	}, [loginMe, from]);

	return (
		<PageFrame>
			<LoginView namespace='console' />
		</PageFrame>
	);
};

export default LoginPage;

export { SESSION_KEY_FROM, SESSION_KEY_STATE };
