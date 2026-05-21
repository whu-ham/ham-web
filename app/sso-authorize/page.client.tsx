/**
 * @author Claude
 * @version 3.1
 * @date 2026/5/21
 *
 * Client-side orchestrator for /sso-authorize.
 *
 * Responsibilities (aligned with requirements §1–§5):
 *   - Parse client_id / scope / redirect_uri / state from the URL once on
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
 *
 * Visibility-aware session refresh (§4):
 *   - While the page is in the `consent` stage, a `visibilitychange`
 *     listener fires whenever the tab returns to the foreground.
 *   - On each restore it calls `WebAuthApi.refresh()` to silently renew
 *     the HttpOnly session cookie. If the session has already expired
 *     (401) the user is sent back to the login stage so they can
 *     re-authenticate without a confusing error.
 *
 * Global state (params, stage, deepLinkUrl) lives in Jotai atoms defined
 * in ./store.ts. All child views read/write atoms directly — no prop
 * drilling for shared state.
 */
'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';

import ConsentView from '@/app/sso-authorize/ConsentView';
import DeepLinkFallback from '@/app/sso-authorize/DeepLinkFallback';
import DeepLinkTrying from '@/app/sso-authorize/DeepLinkTrying';
import InvalidRequestView from '@/app/sso-authorize/InvalidRequestView';
import LoginView from '@/components/LoginView';
import PageFrame from '@/components/PageFrame';
import {
	deepLinkUrlAtom,
	paramsAtom,
	SsoAuthorizeParams,
	stageAtom,
} from '@/app/sso-authorize/store';
import { ApiError, WebAuthApi } from '@/services/sso/api';
import { tryLaunchDeepLink } from '@/services/sso/deepLink';
import { detectDeviceKind } from '@/services/sso/ua';

// Timeouts for the two distinct deep-link attempts. The auto-probe is
// kept short so the user isn't stuck on an empty "loading" screen
// forever; the manual attempt gives the OS a bit more room because the
// user has just physically tapped the button.
const AUTO_PROBE_TIMEOUT_MS = 1500;

// How many milliseconds before the session cookie expires we proactively
// call /web/auth/refresh. 5 minutes gives a comfortable buffer even on
// slow connections.
const SESSION_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseParams(): SsoAuthorizeParams | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const usp = new URLSearchParams(window.location.search);
	const appId = usp.get('client_id')?.trim() ?? '';
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
	const [params, setParams] = useAtom(paramsAtom);
	const [stage, setStage] = useAtom(stageAtom);
	const deepLinkUrl = useAtomValue(deepLinkUrlAtom);

	// Guards the mobile auto-probe so React Strict Mode's double-invoke
	// can't fire the `ham://` navigation twice in quick succession.
	const autoProbeFiredRef = useRef(false);
	// Tracks the wall-clock time (ms) when the session was last confirmed
	// valid so the visibility handler can decide whether a refresh is needed.
	const sessionConfirmedAtRef = useRef<number>(0);

	// Resolve params once (client only — SSR has no window).
	useEffect(() => {
		const parsed = parseParams();
		if (!parsed) {
			setStage({ kind: 'invalid', reason: 'invalid_request' });
			return;
		}
		setParams(parsed);
	}, [setParams, setStage]);

	const probeLoginThenConsent = useCallback(async () => {
		try {
			const me = await WebAuthApi.me();
			sessionConfirmedAtRef.current = Date.now();
			setStage({ kind: 'consent', me });
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				setStage({ kind: 'login' });
				return;
			}
			setStage({ kind: 'login' });
		}
	}, [setStage]);

	// Visibility-aware session refresh
	useEffect(() => {
		const onVisibilityChange = async () => {
			if (document.hidden) return;
			if (stage.kind !== 'consent') return;

			const elapsed = Date.now() - sessionConfirmedAtRef.current;
			if (elapsed < SESSION_REFRESH_BUFFER_MS) {
				return;
			}

			try {
				await WebAuthApi.refresh();
				sessionConfirmedAtRef.current = Date.now();
			} catch (e) {
				if (e instanceof ApiError && e.status === 401) {
					setStage({ kind: 'login' });
				}
			}
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, [stage.kind, setStage]);

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

		setStage({ kind: 'deep-link-trying' });
		tryLaunchDeepLink({
			url: deepLinkUrl,
			timeoutMs: AUTO_PROBE_TIMEOUT_MS,
		}).then((result) => {
			if (result.launched) return;
			setStage({ kind: 'deep-link-fallback' });
		});
	}, [params, deepLinkUrl, probeLoginThenConsent, setStage]);

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	if (stage.kind === 'loading') {
		return <div className={'min-h-screen'} />;
	}

	if (stage.kind === 'invalid') {
		return (
			<PageFrame>
				<InvalidRequestView />
			</PageFrame>
		);
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
				<DeepLinkFallback />
			</PageFrame>
		);
	}

	if (stage.kind === 'login') {
		return (
			<PageFrame>
				<LoginView
					onLoggedIn={(me) => setStage({ kind: 'consent', me })}
					onLoginFailed={() => setStage({ kind: 'login' })}
					namespace='sso'
				/>
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
