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

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
