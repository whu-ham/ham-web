/**
 * @author Claude
 * @version 1.3
 * @date 2026/5/22
 *
 * Tokens page with SSR auth check and token list preloading.
 */
import TokensPage from '@/app/console/tokens/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import { requireAuth } from '@/app/lib/auth';
import { fetchTokenList } from '@/services/token/server';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('apikey');
	return {
		title: t('meta.title'),
	};
};

const Page = async () => {
	await requireAuth('/console/tokens');
	const initialTokens = await fetchTokenList();
	return <TokensPage initialTokens={initialTokens} />;
};

export default Page;
