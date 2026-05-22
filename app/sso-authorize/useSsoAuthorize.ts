/**
 * @author Claude
 * @version 2.2
 * @date 2026/5/22
 *
 * Custom hook for /sso-authorize page orchestration.
 *
 * Responsibilities:
 *   - Parse client_id / scope / redirect_uri / state from the URL
 *   - Detect desktop vs mobile and run deep-link handoff on mobile
 *   - On desktop + !me → client-side redirect to /login
 *   - On desktop + me  → consent stage directly
 *   - On mobile (any auth state) → try deep link first
 *   - Visibility-aware session refresh while on consent stage
 */

'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';

import {
	deepLinkUrlAtom,
	deviceKindAtom,
	paramsAtom,
	SsoAuthorizeParams,
	stageAtom,
} from '@/app/sso-authorize/store';
import { ApiError, MeResponse, WebAuthApi } from '@/services/sso/api';
import { tryLaunchDeepLink } from '@/services/sso/deepLink';
import { detectDeviceKind } from '@/services/sso/ua';

const AUTO_PROBE_TIMEOUT_MS = 1500;
const SESSION_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const parseParams = (): SsoAuthorizeParams | null => {
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
};

export const useSsoAuthorize = (me: MeResponse | null) => {
	const [params, setParams] = useAtom(paramsAtom);
	const [stage, setStage] = useAtom(stageAtom);
	const deepLinkUrl = useAtomValue(deepLinkUrlAtom);
	const setDeviceKind = useSetAtom(deviceKindAtom);

	const autoProbeFiredRef = useRef(false);
	const sessionConfirmedAtRef = useRef<number>(0);

	useEffect(() => {
		const parsed = parseParams();
		if (parsed) {
			setParams(parsed);
		}
		if (sessionConfirmedAtRef.current === 0) {
			sessionConfirmedAtRef.current = Date.now();
		}

		if (typeof navigator !== 'undefined') {
			setDeviceKind(detectDeviceKind(navigator.userAgent));
		}
	}, [setParams, setDeviceKind]);

	const redirectToLogin = useCallback(() => {
		const from = encodeURIComponent(
			window.location.pathname + window.location.search
		);
		window.location.href = `/login?from=${from}`;
	}, []);

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
					redirectToLogin();
				}
			}
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, [stage.kind, redirectToLogin]);

	useEffect(() => {
		if (!params) return;
		const deviceKind =
			typeof navigator === 'undefined'
				? 'desktop'
				: detectDeviceKind(navigator.userAgent);

		if (deviceKind === 'desktop') {
			if (!me) {
				// Desktop + unauthenticated → redirect to /login
				redirectToLogin();
				return;
			}
			// SSR already confirmed auth — go straight to consent
			setStage({ kind: 'consent', me });
			return;
		}

		// Mobile: always try deep link first, regardless of auth state
		if (autoProbeFiredRef.current) return;
		autoProbeFiredRef.current = true;

		setStage({ kind: 'deep-link-trying' });
		tryLaunchDeepLink({
			url: deepLinkUrl,
			timeoutMs: AUTO_PROBE_TIMEOUT_MS,
		}).then((result) => {
			if (result.launched) return;
			setStage({ kind: 'deep-link-fallback', authenticated: !!me });
		});
	}, [params, deepLinkUrl, me, setStage, redirectToLogin]);

	return { stage };
};
