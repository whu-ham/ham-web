/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 */
import ConsolePage from '@/app/console/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('console');
	return {
		title: t('meta.title'),
	};
};

const Page = () => <ConsolePage />;

export default Page;
