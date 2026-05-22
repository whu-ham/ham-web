/**
 * Jotai atoms for the /login page.
 *
 * - `loginSucceededAtom` — signal: set to true when QR/Passkey login succeeds.
 * - `mobileAtom`         — whether the current device is mobile.
 */

import { atom } from 'jotai';

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
