/**
 * @author Claude
 * @version 1.8
 * @date 2026/4/21 12:43:48
 *
 * Client-side orchestrator for /sso-authorize.
 *
 * Responsibilities (aligned with requirements §1–§5):
 *   - Parse app_id / scope / redirect_uri / state from the URL once on
 *     mount. Invalid params render InvalidRequestView without any backend
 *     call.
 *   - Detect desktop vs mobile.
 *     On mobile we run a staged deep-link handoff:
 *       0. Silently fire `ham://...` with a short timeout.
 *       1. If that auto-attempt times out, show DeepLinkTrying — the
 *          "Continuing in Ham…" screen with a manual "Open Ham" button.
 *       2. If the manual attempt also times out or raises synchronously,
 *          switch to DeepLinkFallback which offers App install links and
 *          (when supported) the Passkey fallback.
 *   - On desktop (or the mobile Passkey fallback branch) call /web/auth/me
 *     to detect an existing session. Authenticated → jump straight to the
 *     consent page. Unauthenticated → show the login tabs.
 *   - Shepherd the user through the consent decision and redirect them
 *     back to the third-party `redirect_uri` using
 *     `window.location.replace`.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ConsentView from '@/app/sso-authorize/ConsentView';
import DeepLinkFallback from '@/app/sso-authorize/DeepLinkFallback';
import DeepLinkTrying from '@/app/sso-authorize/DeepLinkTrying';
import InvalidRequestView from '@/app/sso-authorize/InvalidRequestView';
import LoginView from '@/app/sso-authorize/LoginView';
import {
	ApiError,
	MeResponse,
	WebAuthApi,
} from '@/services/sso/api';

import {
	buildSsoAuthorizeDeepLink,
	tryLaunchDeepLink,
} from '@/services/sso/deepLink';
import { detectDeviceKind } from '@/services/sso/ua';

interface SsoAuthorizeParams {
	appId: string;
	scope: string[];
	state: string;
	redirectUri: string;
}

type Stage =
	| { kind: 'loading' }
	| { kind: 'invalid'; reason: string }
	| { kind: 'deep-link-trying' }
	| { kind: 'deep-link-fallback' }
	| { kind: 'login' }
	| { kind: 'consent'; me: MeResponse };

// Timeouts for the two distinct deep-link attempts. The auto-probe is
// kept short so the user isn't stuck on an empty "loading" screen
// forever; the manual attempt gives the OS a bit more room because the
// user has just physically tapped the button.
const AUTO_PROBE_TIMEOUT_MS = 1500;
const MANUAL_PROBE_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseParams(): SsoAuthorizeParams | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const usp = new URLSearchParams(window.location.search);
	const appId = usp.get('app_id')?.trim() ?? '';
	const redirectUri = usp.get('redirect_uri')?.trim() ?? '';
	if (!appId || !redirectUri) {
		return null;
	}
	const rawScope = usp.get('scope') ?? '';
	const scope = rawScope
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	const state = usp.get('state') ?? '';
	return { appId, scope, state, redirectUri };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const SsoAuthorizePage = () => {
	const [params, setParams] = useState<SsoAuthorizeParams | null>(null);
	const [stage, setStage] = useState<Stage>({ kind: 'loading' });
	const [opening, setOpening] = useState(false);
	// Guards the mobile auto-probe so React Strict Mode's double-invoke
	// can't fire the `ham://` navigation twice in quick succession.
	const autoProbeFiredRef = useRef(false);

	// Resolve params once (client only — SSR has no window).
	useEffect(() => {
		const parsed = parseParams();
		if (!parsed) {
			setStage({
				kind: 'invalid',
				reason: 'invalid_request',
			});
			return;
		}
		setParams(parsed);
	}, []);

	const probeLoginThenConsent = useCallback(async () => {
		try {
			const me = await WebAuthApi.me();
			setStage({ kind: 'consent', me });
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				setStage({ kind: 'login' });
				return;
			}
			// Any other error → treat as not-logged-in so the user can
			// still retry via the login tabs.
			setStage({ kind: 'login' });
		}
	}, []);

	const deepLinkUrl = useMemo(() => {
		if (!params) return '';
		return buildSsoAuthorizeDeepLink({
			appId: params.appId,
			scope: params.scope,
			state: params.state,
			redirectUri: params.redirectUri,
		});
	}, [params]);

	useEffect(() => {
		if (!params) return;
		const deviceKind =
			typeof navigator === 'undefined'
				? 'desktop'
				: detectDeviceKind(navigator.userAgent);

		if (deviceKind === 'desktop') {
			probeLoginThenConsent();
			return;
		}

		if (autoProbeFiredRef.current) return;
		autoProbeFiredRef.current = true;

		// Mobile step 0: enter the "trying" screen and auto-fire the deep
		// link. We flip to the "trying" stage first so that the subsequent
		// `ham://` navigation (which can briefly hijack the tab) has a
		// visible context the user understands.
		setStage({ kind: 'deep-link-trying' });
		tryLaunchDeepLink({
			url: deepLinkUrl,
			timeoutMs: AUTO_PROBE_TIMEOUT_MS,
		}).then((result) => {
			// launched=true: the App took focus; we still mount the
			// trying screen underneath so that if the user bounces back
			// (e.g. they cancelled the system prompt) they have the
			// manual retry button ready without any further flicker.
			if (result.launched) return;
			// Either synchronous failure or timeout — both mean the App
			// didn't respond; show the install / passkey fallback.
			setStage({ kind: 'deep-link-fallback' });
		});
	}, [params, deepLinkUrl, probeLoginThenConsent]);

	const openApp = useCallback(async () => {
		if (!deepLinkUrl || opening) return;
		setOpening(true);
		try {
			const result = await tryLaunchDeepLink({
				url: deepLinkUrl,
				timeoutMs: MANUAL_PROBE_TIMEOUT_MS,
			});
			if (!result.launched) {
				// Step 2: manual attempt failed — bump to the install /
				// passkey fallback screen.
				setStage({ kind: 'deep-link-fallback' });
			}
		} finally {
			setOpening(false);
		}
	}, [deepLinkUrl, opening]);

	const reopenApp = useCallback(() => {
		// Called from the "already installed" button on the fallback
		// screen. We deliberately do NOT kick off another probe here
		// because the user has explicitly confirmed they installed the
		// App; a hard navigation is the most reliable handoff.
		if (!deepLinkUrl) return;
		window.location.href = deepLinkUrl;
	}, [deepLinkUrl]);

	const onLoginSucceeded = useCallback(async () => {
		// After a successful QR / Passkey login the Web cookies are set
		// by the backend — re-probe /me to surface the profile on the
		// consent page.
		try {
			const me = await WebAuthApi.me();
			setStage({ kind: 'consent', me });
		} catch {
			setStage({ kind: 'login' });
		}
	}, []);

	const onSwitchAccount = useCallback(async () => {
		try {
			await WebAuthApi.logout();
		} finally {
			setStage({ kind: 'login' });
		}
	}, []);

	const showQRTab = useMemo(() => {
		if (typeof navigator === 'undefined') return true;
		return detectDeviceKind(navigator.userAgent) === 'desktop';
	}, []);

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	const renderStage = () => {
		if (stage.kind === 'loading') {
			return <div className={'min-h-screen'} />;
		}

		if (stage.kind === 'invalid') {
			return <InvalidRequestView />;
		}

		if (stage.kind === 'deep-link-trying') {
			return <DeepLinkTrying deepLinkUrl={deepLinkUrl} />;
		}

		if (stage.kind === 'deep-link-fallback') {
			return (
				<DeepLinkFallback reopenApp={reopenApp} onLoggedIn={onLoginSucceeded} />
			);
		}

		if (stage.kind === 'login') {
			return <LoginView showQR={showQRTab} onLoggedIn={onLoginSucceeded} />;
		}

		// stage.kind === 'consent' — params is guaranteed to be non-null here
		// because we only transition into `consent` after `setParams(parsed)`.
		if (!params) {
			return <InvalidRequestView />;
		}
		return (
			<ConsentView
				params={params}
				me={stage.me}
				onSwitchAccount={onSwitchAccount}
			/>
		);
	};

	return renderStage();
};

export default SsoAuthorizePage;
