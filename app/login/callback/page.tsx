/**
 * @author Claude
 * @version 2.1
 * @date 2026/5/22
 *
 * OAuth2 callback page for mobile app login.
 *
 * Flow:
 *   1. /login page calls POST /api/auth/login-init, which writes
 *      OAuth2 state and redirect target to HttpOnly cookies.
 *   2. App authorizes and redirects back here with ?code=xxx&state=yyy
 *   3. This SSR page validates state against the HttpOnly cookie BEFORE
 *      exchanging the code, preventing OAuth2 Login CSRF.
 *   4. On success, redirects to the original `from` URL (stored in
 *      ham_login_from cookie).
 *   5. On failure, redirects to /login with error details.
 */
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { processAppCallback } from '@/app/lib/auth';
import { safeRedirect } from '@/services/redirect';

const STATE_COOKIE = 'ham_login_state';
const FROM_COOKIE = 'ham_login_from';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('console');
	return { title: t('login.metaTitle') };
};

interface PageProps {
	searchParams: Promise<{ code?: string; state?: string }>;
}

const Page = async ({ searchParams }: PageProps) => {
	const { code, state } = await searchParams;

	if (!code || !state) {
		redirect('/login');
	}

	// Validate OAuth2 state BEFORE code exchange to prevent CSRF.
	const cookieStore = await cookies();
	const storedState = cookieStore.get(STATE_COOKIE)?.value;

	// Clear state cookie immediately (one-time use)
	cookieStore.delete(STATE_COOKIE);

	if (!storedState || storedState !== state) {
		redirect('/login');
	}

	// Process the code exchange (only after state validation passes)
	const result = await processAppCallback(code);
	if (!result.ok) {
		cookieStore.delete(FROM_COOKIE);
		redirect(
			`/login?error=${encodeURIComponent(result.reason || 'callback_failed')}`
		);
	}

	// Read the `from` redirect target from cookie (set by /api/auth/login-init)
	const storedFrom = cookieStore.get(FROM_COOKIE)?.value;
	cookieStore.delete(FROM_COOKIE);

	redirect(safeRedirect(storedFrom, '/console'));
};

export default Page;
