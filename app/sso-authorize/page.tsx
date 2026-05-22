/**
 * @author Claude
 * @version 1.2
 * @date 2026/4/21 20:39:13
 */
import SsoAuthorizePage from '@/app/sso-authorize/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import InvalidRequestView from '@/app/sso-authorize/InvalidRequestView';
import PageFrame from '@/components/layout/PageFrame';

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations('sso');
	const title = t('meta.title');
	const description = t('meta.description');

	return {
		title,
		description,
		// Prevent the authorization code from leaking to third-party origins.
		referrer: 'no-referrer',
		openGraph: {
			title,
			description,
			type: 'website',
			images: [
				{
					url: '/sso-authorize/opengraph-image',
					width: 1200,
					height: 680,
					alt: title,
				},
			],
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
			images: ['/sso-authorize/opengraph-image'],
		},
		// iMessage / iOS rich link preview
		appleWebApp: {
			title,
			statusBarStyle: 'default',
		},
	};
};

interface PageProps {
	searchParams: Promise<{
		client_id?: string;
		redirect_uri?: string;
		scope?: string;
		state?: string;
	}>;
}

const Page = async ({ searchParams }: PageProps) => {
	const { client_id, redirect_uri } = await searchParams;

	if (!client_id?.trim() || !redirect_uri?.trim()) {
		return (
			<PageFrame>
				<InvalidRequestView />
			</PageFrame>
		);
	}

	return <SsoAuthorizePage />;
};

export default Page;
