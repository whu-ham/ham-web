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

/**
 * Server-side mobile detection from User-Agent.
 * Covers standard mobile UAs plus iPadOS ≥ 13 which reports as
 * "Macintosh" in desktop browsing mode. We can't read
 * navigator.maxTouchPoints on the server, so we rely on the
 * Sec-CH-UA-Form-Factors client hint (when available) or fall back
 * to assuming Macintosh + touch could be iPadOS.
 */
const isMobileUA = (
	ua: string,
	secChUaFormFactors?: string | null
): boolean => {
	const lower = ua.toLowerCase();
	// Standard mobile identifiers
	if (/iphone|ipad|ipod|android/i.test(lower)) return true;
	// iPadOS ≥ 13 desktop-mode Safari: UA contains "Macintosh" but
	// the device is a tablet. If Sec-CH-UA-Form-Factors is present
	// and includes "Mobile", treat as mobile. Otherwise, Macintosh
	// with "touch" in the UA hints at iPadOS.
	if (/macintosh/.test(lower)) {
		if (secChUaFormFactors?.toLowerCase().includes('mobile')) return true;
		// Some iPadOS Safari versions include "touch" in the UA or
		// we can check Sec-CH-UA-Form-Factors for "EInk" / "Mobile"
		if (/\btouch\b/.test(lower)) return true;
	}
	return false;
};

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
		const secChUaFormFactors = headersList.get('sec-ch-ua-form-factors');
		// On mobile: let the client try the deep link first, then show login fallback.
		// On desktop: redirect to /login immediately.
		if (!isMobileUA(ua, secChUaFormFactors)) {
			redirect(`/login?from=${encodeURIComponent(from)}`);
		}
	}

	return <SsoAuthorizePage me={me} from={from} />;
};

export default Page;
