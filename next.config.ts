/**
 * @author Claude
 * @version 1.2
 * @date 2026/4/21 20:30:23
 */
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// `next-intl/plugin` wires the `i18n/request.ts` file into every render
// so server components and client components receive the same active
// locale + message catalogue without us having to pass them manually.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
	// M7: Block access to MSW service worker in production.
	// The file exists in public/ for dev but should never be cached
	// or accessible in production deployments.
	headers: async () => [
		{
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
