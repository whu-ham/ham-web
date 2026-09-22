/**
 * @author Claude
 * @version 1.3
 * @date 2026/9/23 01:10:05
 */
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// `next-intl/plugin` wires the `i18n/request.ts` file into every render
// so server components and client components receive the same active
// locale + message catalogue without us having to pass them manually.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Baseline hardening for every response. The consent screen is the one
// place where a click is an authorization decision, so it must not be
// embeddable; and a redirect_uri must not leak through `Referer` on the
// way out of the SSO flow.
//
// No Content-Security-Policy here on purpose: the theme bootstrap script
// runs inline before paint, so a policy would have to allow it anyway.
const SECURITY_HEADERS = [
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'Referrer-Policy', value: 'no-referrer' },
];

const nextConfig: NextConfig = {
	headers: async () => [
		{
			source: '/:path*',
			headers: SECURITY_HEADERS,
		},
		{
			// M7: Block access to MSW service worker in production.
			// The file exists in public/ for dev but should never be cached
			// or accessible in production deployments.
			source: '/mockServiceWorker.js',
			headers: [
				{
					key: 'Cache-Control',
					value: 'no-store, no-cache, must-revalidate, private',
				},
			],
		},
	],
};

export default withNextIntl(nextConfig);
