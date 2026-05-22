/**
 * @author Claude
 * @version 2.0
 * @date 2026/5/22
 *
 * Client-side login page. Handles QR, passkey, and mobile app login.
 * After successful login, redirects to the URL specified in the
 * `from` query parameter (defaults to /console).
 *
 * State management uses Jotai atoms defined in ./store.ts.
 * QRLoginView / PasskeyLoginView write to `loginMeAtom` on success;
 * this component watches it and performs the redirect.
 */
'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import LoginView from '@/app/login/LoginView';
import { fromAtom, loginMeAtom, mobileAtom } from '@/app/login/store';
import PageFrame from '@/components/layout/PageFrame';
import { isMobile } from '@/services/sso/ua';

const LoginPage = () => {
	const searchParams = useSearchParams();
	const [from, setFrom] = useAtom(fromAtom);
	const setMobile = useSetAtom(mobileAtom);
	const [loginMe] = useAtom(loginMeAtom);

	// Initialize atoms on mount
	useEffect(() => {
		const urlFrom = searchParams.get('from');
		setFrom(urlFrom ?? `${window.location.origin}/console`);
		setMobile(isMobile(navigator.userAgent));
	}, [searchParams, setFrom, setMobile]);

	// Redirect when login succeeds
	useEffect(() => {
		if (loginMe && from) {
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
