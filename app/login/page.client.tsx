/**
 * @author Claude
 * @version 3.1
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
 * OAuth2 state and redirect target are persisted to cookies
 * so that /login/callback (SSR) can validate state and redirect
 * without requiring sessionStorage (which SSR cannot access).
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

const STATE_COOKIE = 'ham_login_state';
const FROM_COOKIE = 'ham_login_from';

const generateState = (): string => {
	const arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

const setCookie = (name: string, value: string, maxAge = 600) => {
	document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
};

const deleteCookie = (name: string) => {
	document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
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

		// Generate OAuth2 state for CSRF protection and persist to cookie
		const state = generateState();
		setState(state);
		setCookie(STATE_COOKIE, state, 600); // 10 min
		setCookie(FROM_COOKIE, encodeURIComponent(resolved), 600);
	}, [searchParams, setFrom, setMobile, setState]);

	// Redirect when login succeeds
	useEffect(() => {
		if (loginMe && from) {
			deleteCookie(STATE_COOKIE);
			deleteCookie(FROM_COOKIE);
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
