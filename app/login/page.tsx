/**
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
	const { from } = await searchParams;

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

	const state = crypto.randomUUID();
	const safeFrom = safeRedirect(from);

	return (
		<Suspense>
			<LoginPage initialState={state} from={safeFrom} />
		</Suspense>
	);
};

export default Page;
