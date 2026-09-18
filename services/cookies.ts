/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/18 16:56:23
 *
 * Central registry of all cookie names used across the application.
 * Import from here instead of hard-coding cookie name strings.
 *
 * The browser OAuth flow and the mobile app deep-link login keep
 * separate state cookies on purpose: both mint a CSRF state and both
 * are open at the same time on /login, so a shared name lets either
 * flow invalidate the other's in-flight login.
 */

// --- Auth / Session ---
/** Backend session cookie. */
export const SESSION_COOKIE = 'ham_session';

/** Backend refresh token cookie. */
export const REFRESH_COOKIE = 'ham_refresh';

/** HttpOnly cookie: OAuth2 state for browser OAuth logins (one-time use). */
export const STATE_COOKIE = 'ham_login_state';

/** HttpOnly cookie: redirect target after a browser OAuth login. */
export const FROM_COOKIE = 'ham_login_from';

/** HttpOnly cookie: OAuth2 state for the mobile app deep-link login. */
export const APP_STATE_COOKIE = 'ham_app_login_state';

/** HttpOnly cookie: redirect target after the mobile app deep-link login. */
export const APP_FROM_COOKIE = 'ham_app_login_from';

// --- Preferences ---
/** User locale preference cookie. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** User theme preference cookie. */
export const THEME_COOKIE = 'NEXT_THEME';
