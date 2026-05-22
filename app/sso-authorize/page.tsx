/**
 * @author Claude
 * @version 1.3
 * @date 2026/5/22
 *
 * SSO authorize page.
 * - Desktop + !me → redirect to /login (server-side)
 * - Mobile  + !me → render client component (try deep link first, then fallback with login)
 * - *       + me  → render client component (deep link on mobile, consent on desktop)
 */
import SsoAuthorizePage from '@/app/sso-authorize/page.client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import InvalidRequestView from '@/app/sso-authorize/InvalidRequestView';
import PageFrame from '@/components/layout/PageFrame';
import { fetchMe } from '@/app/lib/auth';

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

/** Simple server-side mobile detection from User-Agent. */
const isMobileUA = (ua: string): boolean =>
	/iphone|ipad|ipod|android/i.test(ua);

const Page = async ({ searchParams }: PageProps) => {
	const { client_id, redirect_uri, scope, state } = await searchParams;

	if (!client_id?.trim() || !redirect_uri?.trim()) {
		return (
			<PageFrame>
				<InvalidRequestView />
			</PageFrame>
		);
	}

	const me = await fetchMe();
	const qs = new URLSearchParams({ client_id, redirect_uri });
	if (scope) qs.set('scope', scope);
	if (state) qs.set('state', state);
	const from = `/sso-authorize?${qs}`;

	if (!me) {
		const headersList = await headers();
		const ua = headersList.get('user-agent') ?? '';
		// On mobile: let the client try the deep link first, then show login fallback.
		// On desktop: redirect to /login immediately.
		if (!isMobileUA(ua)) {
			redirect(`/login?from=${encodeURIComponent(from)}`);
		}
	}

	return <SsoAuthorizePage me={me} />;
};

export default Page;
