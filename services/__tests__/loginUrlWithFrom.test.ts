/**
 * Unit tests for loginUrlWithFrom — the shared "return here after
 * sign-in" link builder.
 *
 * Every SSO entry point builds this URL, so an encoding difference
 * between them would silently drop the user's original destination.
 */
import { describe, expect, it } from 'vitest';

import { loginUrlWithFrom } from '@/services/redirect';

describe('loginUrlWithFrom', () => {
	it('encodes a simple path', () => {
		expect(loginUrlWithFrom('/console')).toBe('/login?from=%2Fconsole');
	});

	it('encodes a nested path', () => {
		expect(loginUrlWithFrom('/console/tokens')).toBe(
			'/login?from=%2Fconsole%2Ftokens'
		);
	});

	it('preserves the query string as a single encoded component', () => {
		// The whole target must survive one decode round-trip, otherwise
		// the authorize flow loses client_id and restarts from scratch.
		const from =
			'/sso-authorize?client_id=app&redirect_uri=https%3A%2F%2Fx.com';
		const url = new URL(loginUrlWithFrom(from), 'https://placeholder.invalid');
		expect(url.pathname).toBe('/login');
		expect(url.searchParams.get('from')).toBe(from);
	});

	it('encodes ampersands so they are not read as separators', () => {
		const url = new URL(
			loginUrlWithFrom('/a?x=1&y=2'),
			'https://placeholder.invalid'
		);
		expect(url.searchParams.get('from')).toBe('/a?x=1&y=2');
	});

	it('handles an empty path', () => {
		expect(loginUrlWithFrom('')).toBe('/login?from=');
	});
});
