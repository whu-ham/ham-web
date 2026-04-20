/**
 * @author Codex
 * @version 1.0
 * @date 2026/4/20
 */
import SsoAuthorizePage from '@/app/sso-authorize/page.client';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
	const t = await getTranslations('sso');
	return {
		title: t('meta.title'),
		// The browser MUST NOT leak the authorization code back to the
		// third-party origin or any CDN telemetry. Setting a page-level
		// referrer policy is the least-privileged way to enforce that.
		referrer: 'no-referrer',
	};
}

const Page = () => <SsoAuthorizePage />;

export default Page;
