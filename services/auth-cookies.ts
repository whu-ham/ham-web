/**
 * Shared cookie name constants for the login/auth flow.
 * Used by both server actions and the callback SSR page.
 */

/** HttpOnly cookie: stores the OAuth2 state for CSRF protection (one-time use). */
export const STATE_COOKIE = 'ham_login_state';

/** HttpOnly cookie: stores the redirect target URL after login. */
export const FROM_COOKIE = 'ham_login_from';
