/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 */
import ApiKeysPage from '@/app/console/apikeys/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('apikey');
	return {
		title: t('meta.title'),
	};
};

const Page = () => <ApiKeysPage />;

export default Page;
