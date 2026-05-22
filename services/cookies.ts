/**
 * Central registry of all cookie names used across the application.
 * Import from here instead of hard-coding cookie name strings.
 */

// --- Auth / Session ---
/** Backend session cookie. */
export const SESSION_COOKIE = 'ham_session';

/** Backend refresh token cookie. */
export const REFRESH_COOKIE = 'ham_refresh';

/** HttpOnly cookie: stores the OAuth2 state for CSRF protection (one-time use). */
export const STATE_COOKIE = 'ham_login_state';

/** HttpOnly cookie: stores the redirect target URL after login. */
export const FROM_COOKIE = 'ham_login_from';

// --- Preferences ---
/** User locale preference cookie. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** User theme preference cookie. */
export const THEME_COOKIE = 'NEXT_THEME';
