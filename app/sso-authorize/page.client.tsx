/**
 * @author Claude
 * @version 4.2
 * @date 2026/5/22
 *
 * Client-side orchestrator for /sso-authorize.
 * Rendering-only — all orchestration logic lives in useSsoAuthorize.
 *
 * `me` may be null when the user is unauthenticated on mobile
 * (server lets the client try deep link first).
 */

'use client';

import ConsentView from '@/app/sso-authorize/ConsentView';
import DeepLinkFallback from '@/app/sso-authorize/DeepLinkFallback';
import DeepLinkTrying from '@/app/sso-authorize/DeepLinkTrying';
import PageFrame from '@/components/layout/PageFrame';
import { useSsoAuthorize } from '@/app/sso-authorize/useSsoAuthorize';
import type { MeResponse } from '@/services/sso/api';

interface SsoAuthorizePageProps {
	me: MeResponse | null;
	from: string;
}

const SsoAuthorizePage = ({ me, from }: SsoAuthorizePageProps) => {
	const { stage } = useSsoAuthorize(me);

	if (stage.kind === 'loading') {
		return <div className={'min-h-screen'} />;
	}

	if (stage.kind === 'deep-link-trying') {
		return (
			<PageFrame>
				<DeepLinkTrying />
			</PageFrame>
		);
	}

	if (stage.kind === 'deep-link-fallback') {
		return (
			<PageFrame>
				<DeepLinkFallback isAuthenticated={stage.authenticated} from={from} />
			</PageFrame>
		);
	}

	// stage.kind === 'consent'
	return (
		<PageFrame>
			<ConsentView />
		</PageFrame>
	);
};

export default SsoAuthorizePage;
