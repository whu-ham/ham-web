/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Client-side redirector after successful app callback.
 * Reads `from` and `state` from sessionStorage (set by /login page)
 * and redirects to the final destination.
 *
 * This page exists because the SSR callback handler cannot access
 * sessionStorage — it needs a client component to read it.
 */
'use client';

import { useEffect } from 'react';

const SESSION_KEY_FROM = 'ham_login_from';
const SESSION_KEY_STATE = 'ham_login_state';

const CallbackDonePage = () => {
	useEffect(() => {
		const from =
			sessionStorage.getItem(SESSION_KEY_FROM) ||
			`${window.location.origin}/console`;
		sessionStorage.removeItem(SESSION_KEY_FROM);
		sessionStorage.removeItem(SESSION_KEY_STATE);
		window.location.href = from;
	}, []);

	return (
		<div className='min-h-screen flex items-center justify-center'>
			<p className='text-sm text-muted'>Redirecting…</p>
		</div>
	);
};

export default CallbackDonePage;
