/**
 * Jotai atoms for the /login page.
 *
 * - `loginSucceededAtom` — signal: set to true when QR/Passkey login succeeds.
 * - `mobileAtom`         — whether the current device is mobile.
 * - `stateAtom`          — OAuth2 state for CSRF protection, generated in SSR.
 * - `deepLinkUrlAtom`    — derived `ham://` deep-link URL for mobile app login.
 *                          Lazily computed — returns '' until state is set
 *                          client-side (avoids SSR empty-origin issue).
 */

import { atom } from 'jotai';

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

/** Signal: set to true when QR/Passkey login succeeds. Triggers redirect. */
export const loginSucceededAtom = atom(false);

/** Whether the current device is mobile. Set on mount. */
export const mobileAtom = atom(false);

/** OAuth2 state parameter for CSRF protection. Set from SSR prop. */
export const stateAtom = atom<string>('');

/**
 * Derived: builds the `ham://` deep-link URL with fixed redirectUri and state.
 * M6 fix: origin is computed lazily only when state is available on the client.
 * On SSR, state is '' so this returns '' early — no invalid URL generated.
 */
export const deepLinkUrlAtom = atom<string>((get) => {
	const state = get(stateAtom);
	if (!state) return '';
	// Only compute origin on client; on SSR this branch is unreachable
	// because state is always '' during SSR.
	if (typeof window === 'undefined') return '';
	return buildSsoAuthorizeDeepLink({
		appId: process.env.NEXT_PUBLIC_CONSOLE_CLIENT_ID ?? '',
		scope: [],
		state,
		redirectUri: `${window.location.origin}${APP_CALLBACK_PATH}`,
	});
});
