/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Jotai atoms for the /login page.
 *
 * - `fromAtom`        — URL to redirect to after login (from searchParams).
 * - `loginMeAtom`     — set by QRLoginView / PasskeyLoginView on success.
 * - `mobileAtom`      — whether the current device is mobile.
 * - `deepLinkUrlAtom` — derived `ham://` deep-link URL for mobile app login.
 */

import { atom } from 'jotai';

import { MeResponse } from '@/services/sso/api';
import { buildSsoAuthorizeDeepLink } from '@/services/sso/deepLink';

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

/** URL to redirect to after successful login. Set from searchParams on mount. */
export const fromAtom = atom<string>('');

/** Set by QRLoginView / PasskeyLoginView when login succeeds. */
export const loginMeAtom = atom<MeResponse | null>(null);

/** Whether the current device is mobile. Set on mount. */
export const mobileAtom = atom(false);

/** Derived: builds the `ham://` deep-link URL from current `fromAtom`. */
export const deepLinkUrlAtom = atom<string>((get) => {
	const from = get(fromAtom);
	if (!from) return '';
	return buildSsoAuthorizeDeepLink({
		appId: process.env.NEXT_PUBLIC_CONSOLE_CLIENT_ID ?? '',
		scope: [],
		state: '',
		redirectUri: from,
	});
});
