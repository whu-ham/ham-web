/**
 * @author Claude
 * @version 3.0
 * @date 2026/4/21 19:47:00
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
import HeaderBar from '@/app/sso-authorize/HeaderBar';
import InvalidRequestView from '@/app/sso-authorize/InvalidRequestView';
import LoginView from '@/app/sso-authorize/LoginView';
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
// PageFrame
// ---------------------------------------------------------------------------

const PageFrame = ({ children }: { children: React.ReactNode }) => (
	<div
		className={
			'min-h-screen w-full overflow-x-hidden flex flex-col items-center justify-center bg-default px-1 sm:px-2 md:px-4 py-20'
		}
	>
		<HeaderBar />
		<div
			className={
				'bg-surface rounded-[16px] p-6 md:p-10 w-full max-w-md flex flex-col items-stretch gap-6'
			}
		>
			{children}
		</div>
	</div>
);

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
	// We intentionally do NOT call setStage here on success — the stage
	// stays 'loading' until the second effect (which depends on params)
	// actually transitions it. This prevents a one-frame flash of an empty
	// PageFrame card between the two effects.
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
			// Any other error → treat as not-logged-in so the user can
			// still retry via the login tabs.
			setStage({ kind: 'login' });
		}
	}, [setStage]);

	// Visibility-aware session refresh: when the consent page is active and
	// the tab returns to the foreground, silently renew the session cookie.
	// If the session has expired the user is sent back to login.
	useEffect(() => {
		const onVisibilityChange = async () => {
			if (document.hidden) return;
			// Only act when the user is on the consent screen.
			if (stage.kind !== 'consent') return;

			const elapsed = Date.now() - sessionConfirmedAtRef.current;
			if (elapsed < SESSION_REFRESH_BUFFER_MS) {
				// Session is still fresh — no refresh needed yet.
				return;
			}

			// Session is approaching expiry (or we don't know when it was
			// last confirmed). Attempt a silent refresh.
			try {
				await WebAuthApi.refresh();
				sessionConfirmedAtRef.current = Date.now();
			} catch (e) {
				if (e instanceof ApiError && e.status === 401) {
					// Session has fully expired — send the user back to login.
					setStage({ kind: 'login' });
				}
				// Other errors (network blip, 5xx) are silently ignored;
				// the consent submit will surface them if they persist.
			}
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, [stage.kind, setStage]);

	useEffect(() => {
		if (!params) return;
		// params is now set — immediately transition away from 'loading'
		// so there is no frame where stage is not 'loading' but params is null.
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
				<LoginView />
			</PageFrame>
		);
	}

	// stage.kind === 'consent' — params is guaranteed to be non-null here
	// because we only transition into `consent` after `setParams(parsed)`.
	// The 'loading' guard above ensures we never reach here with params=null.
	return (
		<PageFrame>
			<ConsentView />
		</PageFrame>
	);
};

export default SsoAuthorizePage;
