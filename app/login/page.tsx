/**
 * Standalone login page. Redirects here from protected routes
 * when the user is not authenticated.
 *
 * No cookies are generated on this page. STATE_COOKIE and FROM_COOKIE
 * are set lazily via a server action when the user initiates mobile
 * app login (see app/login/actions.ts).
 */
import { Suspense } from 'react';

import LoginPage from '@/app/login/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { fetchMe } from '@/app/lib/auth';
import { safeRedirect } from '@/services/redirect';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('console');
	return { title: t('login.metaTitle') };
};

interface PageProps {
	searchParams: Promise<{ from?: string; error?: string }>;
}

const Page = async ({ searchParams }: PageProps) => {
	const me = await fetchMe();
	const { from, error } = await searchParams;

	if (me) {
		const headersList = await headers();
		const host = headersList.get('host') || 'localhost:3000';
		const isLocalhost = host.startsWith('localhost');
		const protocol = isLocalhost
			? 'http'
			: headersList.get('x-forwarded-proto') || 'https';
		const fallback = `${protocol}://${host}/console`;
		return redirect(safeRedirect(from, fallback));
	}

	const safeFrom = safeRedirect(from);

	return (
		<Suspense>
			<LoginPage from={safeFrom} error={error} />
		</Suspense>
	);
};

export default Page;
