/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/22
 *
 * Tokens page with SSR auth check and token list preloading.
 */
import TokensPage from '@/app/console/tokens/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { fetchMe } from '@/services/sso/server';
import { fetchTokenList } from '@/services/token/server';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('apikey');
	return {
		title: t('meta.title'),
	};
};

const Page = async () => {
	const me = await fetchMe();
	if (!me) {
		const headersList = await headers();
		const host = headersList.get('host') || 'localhost:3000';
		const protocol = headersList.get('x-forwarded-proto') || 'https';
		const from = `${protocol}://${host}/console/tokens`;
		redirect(`/login?from=${encodeURIComponent(from)}`);
	}

	const initialTokens = await fetchTokenList();
	return <TokensPage initialTokens={initialTokens} />;
};

export default Page;
