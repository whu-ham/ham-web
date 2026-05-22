/**
 * @author Claude
 * @version 1.4
 * @date 2026/5/22
 *
 * Console page with SSR auth check.
 * - If not authenticated, redirects to /login.
 * - Otherwise, renders the console view with user data.
 */
import ConsolePage from '@/app/console/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import { requireAuth } from '@/app/lib/auth';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('console');
	return { title: t('meta.title') };
};

const Page = async () => {
	const me = await requireAuth('/console');
	return <ConsolePage me={me} />;
};

export default Page;
