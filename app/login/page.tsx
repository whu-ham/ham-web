/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Standalone login page. Redirects here from protected routes
 * when the user is not authenticated.
 *
 * C1: OAuth2 state and redirect target are set as HttpOnly cookies
 * directly in this SSR page — no extra client-side fetch needed.
 */
import { Suspense } from 'react';

import LoginPage from '@/app/login/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { fetchMe } from '@/app/lib/auth';
import { safeRedirect } from '@/services/redirect';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('console');
	return { title: t('login.metaTitle') };
};

const STATE_COOKIE = 'ham_login_state';
const FROM_COOKIE = 'ham_login_from';
const isDev = process.env.NODE_ENV === 'development';

const cookieOpts = (maxAge: number) => ({
	httpOnly: true,
	secure: !isDev,
	sameSite: 'lax' as const,
	maxAge,
	path: '/login',
});

interface PageProps {
	searchParams: Promise<{ from?: string }>;
}

const Page = async ({ searchParams }: PageProps) => {
	const me = await fetchMe();
	const { from } = await searchParams;

	if (me) {
		const headersList = await headers();
		const host = headersList.get('host') || 'localhost:3000';
		// m1: Use http for localhost, https otherwise
		const isLocalhost = host.startsWith('localhost');
		const protocol = isLocalhost
			? 'http'
			: headersList.get('x-forwarded-proto') || 'https';
		const fallback = `${protocol}://${host}/console`;
		return redirect(safeRedirect(from, fallback));
	}

	// C1: Generate OAuth2 state and set HttpOnly cookies in SSR.
	// No client-side fetch needed — cookies are set before the page renders.
	const safeFrom = safeRedirect(from, '/console');
	const state = crypto.randomUUID().replaceAll('-', '');
	const cookieStore = await cookies();
	cookieStore.set(STATE_COOKIE, state, cookieOpts(600));
	cookieStore.set(FROM_COOKIE, safeFrom, cookieOpts(600));

	return (
		<Suspense>
			<LoginPage initialState={state} from={safeFrom} />
		</Suspense>
	);
};

export default Page;
