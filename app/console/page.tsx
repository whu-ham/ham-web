/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/22
 *
 * Console page with SSR auth check.
 * - If code param present, processes app callback and redirects.
 * - If not authenticated, redirects to /login.
 * - Otherwise, renders the console view with user data.
 */
import ConsolePage from '@/app/console/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { fetchMe, processAppCallback } from '@/services/sso/server';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('console');
	return { title: t('meta.title') };
};

interface PageProps {
	searchParams: Promise<{ code?: string; state?: string }>;
}

const Page = async ({ searchParams }: PageProps) => {
	const { code } = await searchParams;

	// Process app callback if code is present (mobile deep-link return)
	if (code) {
		const success = await processAppCallback(code);
		if (success) {
			redirect('/console');
		}
		// Callback failed — fall through to auth check
	}

	const me = await fetchMe();
	if (!me) {
		const headersList = await headers();
		const host = headersList.get('host') || 'localhost:3000';
		const protocol = headersList.get('x-forwarded-proto') || 'https';
		const from = `${protocol}://${host}/console`;
		redirect(`/login?from=${encodeURIComponent(from)}`);
	}

	return <ConsolePage me={me} />;
};

export default Page;
