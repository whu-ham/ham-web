/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests pinning the cookie-name registry.
 *
 * The names are a wire contract with the backend (`ham_session` /
 * `ham_refresh` are set by it) and with the OAuth cookies we mint
 * ourselves, so a rename here silently breaks login in a way no type
 * checker catches. The tests assert the literal strings, not the
 * constants, for exactly that reason.
 */
import { describe, expect, it } from 'vitest';

import {
	APP_FROM_COOKIE,
	APP_STATE_COOKIE,
	FROM_COOKIE,
	LOCALE_COOKIE,
	REFRESH_COOKIE,
	SESSION_COOKIE,
	STATE_COOKIE,
	THEME_COOKIE,
} from '@/services/cookies';

describe('cookie registry', () => {
	it('names the session cookies the backend sets', () => {
		expect(SESSION_COOKIE).toBe('ham_session');
		expect(REFRESH_COOKIE).toBe('ham_refresh');
	});

	it('names the browser OAuth login cookies', () => {
		expect(STATE_COOKIE).toBe('ham_login_state');
		expect(FROM_COOKIE).toBe('ham_login_from');
	});

	// The deep-link login mints its own state while /login is still
	// rendering the OAuth links, so a shared name would let one flow
	// invalidate the other's in-flight login.
	it('keeps the app login cookies disjoint from the OAuth ones', () => {
		expect(APP_STATE_COOKIE).toBe('ham_app_login_state');
		expect(APP_FROM_COOKIE).toBe('ham_app_login_from');

		const browserNames = [STATE_COOKIE, FROM_COOKIE];
		expect(browserNames).not.toContain(APP_STATE_COOKIE);
		expect(browserNames).not.toContain(APP_FROM_COOKIE);
	});

	it('names the preference cookies the middleware and theme read', () => {
		expect(LOCALE_COOKIE).toBe('NEXT_LOCALE');
		expect(THEME_COOKIE).toBe('NEXT_THEME');
	});

	it('exports no duplicate names', () => {
		const names = [
			SESSION_COOKIE,
			REFRESH_COOKIE,
			STATE_COOKIE,
			FROM_COOKIE,
			APP_STATE_COOKIE,
			APP_FROM_COOKIE,
			LOCALE_COOKIE,
			THEME_COOKIE,
		];

		expect(new Set(names).size).toBe(names.length);
	});
});
