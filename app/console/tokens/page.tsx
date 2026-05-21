/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/22
 */
import TokensPage from '@/app/console/tokens/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import { fetchTokenList } from '@/services/token/server';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('apikey');
	return {
		title: t('meta.title'),
	};
};

const Page = async () => {
	const initialTokens = await fetchTokenList();
	return <TokensPage initialTokens={initialTokens} />;
};

export default Page;
