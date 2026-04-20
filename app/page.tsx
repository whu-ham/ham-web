/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/1/25 12:40
 */
import { CardItem, Header } from '@/app/page.client';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
	const t = await getTranslations('home');
	return {
		title: t('meta.title'),
	};
}

const HomePage = () => {
	return (
		<div className={'p-8 sm:p-20 min-h-screen'}>
			<Header />
			<div className={'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'}>
				<CardItem />
			</div>
		</div>
	);
};

export default HomePage;
