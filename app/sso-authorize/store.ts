/**
 * @author Claude
 * @version 1.2
 * @date 2026/5/26 10:42:28
 *
 * Jotai atoms for the /sso-authorize page.
 *
 * - `paramsAtom`     — parsed URL params (null until client mount).
 * - `stageAtom`      — current page stage (loading → consent/etc.).
 * - `deepLinkUrlAtom`— derived `ham://` deep-link URL (empty string when
 *                      params are not yet available).
 * - `deviceKindAtom` — detected device kind (computed once on mount).
 */

import { atom } from 'jotai';

import { MeResponse } from '@/services/sso/api';
import { buildSsoAuthorizeDeepLink } from '@/services/sso/deepLink';
import { DeviceKind } from '@/services/sso/ua';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SsoAuthorizeParams {
	appId: string;
	scope: string[];
	state: string;
	redirectUri: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
	nonce?: string;
}

export type Stage =
	| { kind: 'loading' }
	| { kind: 'deep-link-trying' }
	| { kind: 'deep-link-fallback'; authenticated: boolean }
	| { kind: 'consent'; me: MeResponse };

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export const paramsAtom = atom<SsoAuthorizeParams | null>(null);

export const stageAtom = atom<Stage>({ kind: 'loading' });

/** M7: Device kind computed once and shared across components */
export const deviceKindAtom = atom<DeviceKind>('desktop');

/** Derived: builds the `ham://` deep-link URL from current params. */
export const deepLinkUrlAtom = atom<string>((get) => {
	const params = get(paramsAtom);
	if (!params) return '';
	return buildSsoAuthorizeDeepLink({
		appId: params.appId,
		scope: params.scope,
		state: params.state,
		redirectUri: params.redirectUri,
	});
});
