/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Standalone login page. Redirects here from protected routes
 * when the user is not authenticated.
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
	searchParams: Promise<{ from?: string }>;
}

const Page = async ({ searchParams }: PageProps) => {
	const me = await fetchMe();
	if (me) {
		const { from } = await searchParams;
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

	return (
		<Suspense>
			<LoginPage />
		</Suspense>
	);
};

export default Page;
