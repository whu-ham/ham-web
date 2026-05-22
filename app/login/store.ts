/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/22
 *
 * Jotai atoms for the /login page.
 *
 * - `fromAtom`        — URL to redirect to after login (from searchParams).
 * - `loginMeAtom`     — set by QRLoginView / PasskeyLoginView on success.
 * - `mobileAtom`      — whether the current device is mobile.
 * - `stateAtom`       — OAuth2 state for CSRF protection, generated on mount.
 * - `deepLinkUrlAtom` — derived `ham://` deep-link URL for mobile app login.
 */

import { atom } from 'jotai';

import { MeResponse } from '@/services/sso/api';
import { buildSsoAuthorizeDeepLink } from '@/services/sso/deepLink';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fixed redirect_uri for app OAuth2 callback.
 * Must be registered with the backend's allowed redirect URIs.
 */
export const APP_CALLBACK_PATH = '/login/callback';

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

/** URL to redirect to after successful login. Set from searchParams on mount. */
export const fromAtom = atom<string>('');

/** Set by QRLoginView / PasskeyLoginView when login succeeds. */
export const loginMeAtom = atom<MeResponse | null>(null);

/** Whether the current device is mobile. Set on mount. */
export const mobileAtom = atom(false);

/** OAuth2 state parameter for CSRF protection. Generated on mount. */
export const stateAtom = atom<string>('');

/** Derived: builds the `ham://` deep-link URL with fixed redirectUri and state. */
export const deepLinkUrlAtom = atom<string>((get) => {
	const state = get(stateAtom);
	if (!state) return '';
	const origin = typeof window !== 'undefined' ? window.location.origin : '';
	return buildSsoAuthorizeDeepLink({
		appId: process.env.NEXT_PUBLIC_CONSOLE_CLIENT_ID ?? '',
		scope: [],
		state,
		redirectUri: `${origin}${APP_CALLBACK_PATH}`,
	});
});
