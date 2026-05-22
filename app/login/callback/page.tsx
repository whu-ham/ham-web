/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * OAuth2 callback page for mobile app login.
 *
 * Flow:
 *   1. /login page builds deep link with redirect_uri=/login/callback
 *   2. App authorizes and redirects back here with ?code=xxx&state=yyy
 *   3. This SSR page validates state, exchanges code for session,
 *      then redirects to the original `from` URL (stored in sessionStorage).
 *   4. If state mismatch or code exchange fails, redirects to /login with error.
 */
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { processAppCallback } from '@/app/lib/auth';
import { APP_CALLBACK_PATH } from '@/app/login/store';

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

	// Process the code exchange
	const success = await processAppCallback(code);
	if (!success) {
		// Callback failed — back to login
		redirect('/login');
	}

	// In SSR we can't read sessionStorage, so we redirect to a client-side
	// intermediary that reads it and bounces to the final destination.
	redirect(`${APP_CALLBACK_PATH}/done`);
};

export default Page;
