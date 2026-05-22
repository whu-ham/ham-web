/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/22
 *
 * Client-side redirector after successful app callback.
 * Reads `from` and `state` from sessionStorage (set by /login page),
 * validates that the returned state matches the stored one (CSRF protection),
 * then redirects to the final destination.
 *
 * This page exists because the SSR callback handler cannot access
 * sessionStorage — it needs a client component to read it.
 */
'use client';

import { useEffect } from 'react';

import { safeRedirect } from '@/services/redirect';

const SESSION_KEY_FROM = 'ham_login_from';
const SESSION_KEY_STATE = 'ham_login_state';

const CallbackDonePage = () => {
	useEffect(() => {
		const storedFrom = sessionStorage.getItem(SESSION_KEY_FROM);
		const storedState = sessionStorage.getItem(SESSION_KEY_STATE);

		sessionStorage.removeItem(SESSION_KEY_FROM);
		sessionStorage.removeItem(SESSION_KEY_STATE);

		// Validate OAuth2 state to prevent CSRF / account-confusion attacks.
		// The SSR callback already received ?state=yyy but couldn't compare it
		// with sessionStorage. We pass it through the URL hash so this client
		// page can verify it.
		const urlState = new URLSearchParams(window.location.search).get('state');
		if (!storedState || !urlState || storedState !== urlState) {
			window.location.href = '/login';
			return;
		}

		const from = safeRedirect(storedFrom, '/console');
		window.location.href = from;
	}, []);

	return (
		<div className='min-h-screen flex items-center justify-center'>
			<p className='text-sm text-muted'>Redirecting…</p>
		</div>
	);
};

export default CallbackDonePage;
