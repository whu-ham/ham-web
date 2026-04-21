/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/21 14:51:13
 *
 * Jotai atoms for the /sso-authorize page.
 *
 * - `paramsAtom`     — parsed URL params (null until client mount).
 * - `stageAtom`      — current page stage (loading → login/consent/etc.).
 * - `deepLinkUrlAtom`— derived `ham://` deep-link URL (empty string when
 *                      params are not yet available).
 */

import { atom } from 'jotai';

import { MeResponse } from '@/services/sso/api';
import { buildSsoAuthorizeDeepLink } from '@/services/sso/deepLink';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SsoAuthorizeParams {
	appId: string;
	scope: string[];
	state: string;
	redirectUri: string;
}

export type Stage =
	| { kind: 'loading' }
	| { kind: 'invalid'; reason: string }
	| { kind: 'deep-link-trying' }
	| { kind: 'deep-link-fallback' }
	| { kind: 'login' }
	| { kind: 'consent'; me: MeResponse };

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export const paramsAtom = atom<SsoAuthorizeParams | null>(null);

export const stageAtom = atom<Stage>({ kind: 'loading' });

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
