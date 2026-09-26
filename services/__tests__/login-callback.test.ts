/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the mobile app deep-link login callback helpers.
 *
 * The redirect guard is the security-sensitive part: `from` reaches the
 * callback as a cookie the app login wrote, but it still has to be
 * treated as untrusted, because a relative-looking value such as
 * `//evil.com` is an open redirect and `/\evil.com` is the same thing
 * with a backslash some browsers normalise to a slash.
 */
import { describe, expect, it } from 'vitest';

import { APP_FROM_COOKIE, APP_STATE_COOKIE } from '@/services/cookies';
import {
	APP_CALLBACK_BACKEND_PATH,
	expireLoginCookie,
	getBackendSetCookies,
	LOGIN_CALLBACK_COOKIES,
	parseAllowedRedirectHosts,
	readCookieFromHeader,
	safeRedirectWithAllowedHosts,
} from '@/services/login-callback';

const hosts = (...values: string[]) => new Set(values);

describe('parseAllowedRedirectHosts', () => {
	it('returns an empty set when the value is missing', () => {
		expect(parseAllowedRedirectHosts(undefined).size).toBe(0);
	});

	it('returns an empty set for an empty or separator-only value', () => {
		expect(parseAllowedRedirectHosts('').size).toBe(0);
		expect(parseAllowedRedirectHosts(' , , ').size).toBe(0);
	});

	it('splits, trims and lowercases the list', () => {
		const parsed = parseAllowedRedirectHosts(
			' Ham.Nowcent.cn , docs.ham.nowcent.cn '
		);

		expect([...parsed]).toEqual(['ham.nowcent.cn', 'docs.ham.nowcent.cn']);
	});

	it('drops empty entries', () => {
		const parsed = parseAllowedRedirectHosts('a.com,,b.com,');

		expect([...parsed]).toEqual(['a.com', 'b.com']);
	});
});

describe('safeRedirectWithAllowedHosts', () => {
	it('returns the fallback when there is no target', () => {
		expect(safeRedirectWithAllowedHosts(null, hosts())).toBe('/console');
		expect(safeRedirectWithAllowedHosts(undefined, hosts())).toBe('/console');
		expect(safeRedirectWithAllowedHosts('', hosts())).toBe('/console');
	});

	it('accepts a same-origin relative path', () => {
		expect(safeRedirectWithAllowedHosts('/console/tokens', hosts())).toBe(
			'/console/tokens'
		);
		expect(
			safeRedirectWithAllowedHosts('/sso-authorize?client_id=app', hosts())
		).toBe('/sso-authorize?client_id=app');
	});

	// Protocol-relative URLs inherit the current scheme and land on
	// another host — the classic open redirect.
	it('rejects a protocol-relative URL', () => {
		expect(safeRedirectWithAllowedHosts('//evil.com', hosts())).toBe(
			'/console'
		);
		expect(safeRedirectWithAllowedHosts('//evil.com', hosts('evil.com'))).toBe(
			'/console'
		);
	});

	// Some browsers normalise a leading `/\` to `//`, so the backslash
	// form has to be rejected by the same rule.
	it('rejects a backslash-prefixed path', () => {
		expect(safeRedirectWithAllowedHosts('/\\evil.com', hosts())).toBe(
			'/console'
		);
	});

	it('rejects schemes other than http and https', () => {
		expect(safeRedirectWithAllowedHosts('javascript:alert(1)', hosts())).toBe(
			'/console'
		);
		expect(safeRedirectWithAllowedHosts('data:text/html,x', hosts())).toBe(
			'/console'
		);
		expect(safeRedirectWithAllowedHosts('ham://sso-authorize', hosts())).toBe(
			'/console'
		);
	});

	// With no allow-list configured only relative paths may pass, so an
	// absolute URL to any host is rejected.
	it('rejects absolute URLs when the allow-list is empty', () => {
		expect(
			safeRedirectWithAllowedHosts('https://ham.nowcent.cn/console', hosts())
		).toBe('/console');
		expect(
			safeRedirectWithAllowedHosts('http://localhost:3000/x', hosts())
		).toBe('/console');
	});

	it('accepts an exact host match', () => {
		expect(
			safeRedirectWithAllowedHosts(
				'https://ham.nowcent.cn/console',
				hosts('ham.nowcent.cn')
			)
		).toBe('https://ham.nowcent.cn/console');
	});

	it('accepts a subdomain of an allowed host', () => {
		expect(
			safeRedirectWithAllowedHosts(
				'https://docs.ham.nowcent.cn/console',
				hosts('ham.nowcent.cn')
			)
		).toBe('https://docs.ham.nowcent.cn/console');
	});

	// A suffix match that is not a subdomain boundary — `evilham.nowcent.cn`
	// would otherwise inherit the trust given to `ham.nowcent.cn`.
	it('rejects a host that only ends with an allowed name', () => {
		expect(
			safeRedirectWithAllowedHosts(
				'https://evilham.nowcent.cn/console',
				hosts('ham.nowcent.cn')
			)
		).toBe('/console');
	});

	it('matches hosts case-insensitively', () => {
		expect(
			safeRedirectWithAllowedHosts(
				'https://Ham.Nowcent.cn/console',
				hosts('ham.nowcent.cn')
			)
		).toBe('https://Ham.Nowcent.cn/console');
	});

	it('uses the fallback it is given', () => {
		expect(safeRedirectWithAllowedHosts('//evil.com', hosts(), '/home')).toBe(
			'/home'
		);
	});

	it('rejects a target that is not a URL at all', () => {
		expect(safeRedirectWithAllowedHosts('not a url', hosts())).toBe('/console');
	});
});

describe('readCookieFromHeader', () => {
	it('returns undefined when there is no header', () => {
		expect(readCookieFromHeader(null, 'ham_session')).toBeUndefined();
		expect(readCookieFromHeader(undefined, 'ham_session')).toBeUndefined();
		expect(readCookieFromHeader('', 'ham_session')).toBeUndefined();
	});

	it('reads a cookie from the jar', () => {
		expect(
			readCookieFromHeader('ham_session=abc; other=1', 'ham_session')
		).toBe('abc');
	});

	it('reads the last entry of the jar', () => {
		expect(
			readCookieFromHeader('other=1; ham_session=abc', 'ham_session')
		).toBe('abc');
	});

	it('tolerates whitespace around the entries', () => {
		expect(
			readCookieFromHeader('  other=1 ;   ham_session = abc  ', 'ham_session')
		).toBe('abc');
	});

	it('skips entries without a value separator', () => {
		expect(readCookieFromHeader('broken; ham_session=abc', 'ham_session')).toBe(
			'abc'
		);
		expect(readCookieFromHeader('broken', 'ham_session')).toBeUndefined();
	});

	it('does not confuse a same-suffixed name with the target', () => {
		expect(
			readCookieFromHeader('xham_session=nope; ham_session=abc', 'ham_session')
		).toBe('abc');
	});

	it('keeps a value with an embedded equals sign', () => {
		expect(readCookieFromHeader('ham_session=a=b=c', 'ham_session')).toBe(
			'a=b=c'
		);
	});

	it('decodes an URL-encoded value', () => {
		expect(
			readCookieFromHeader(
				'ham_login_from=%2Fconsole%3Fx%3D1',
				'ham_login_from'
			)
		).toBe('/console?x=1');
	});

	// A malformed escape sequence makes decodeURIComponent throw; the raw
	// value is still better than dropping the redirect target entirely.
	it('falls back to the raw value when it is not decodable', () => {
		expect(readCookieFromHeader('ham_session=%E0%A4%A', 'ham_session')).toBe(
			'%E0%A4%A'
		);
	});

	it('returns undefined when the cookie is not present', () => {
		expect(readCookieFromHeader('other=1', 'ham_session')).toBeUndefined();
	});
});

describe('expireLoginCookie', () => {
	it('writes a cookie header that clears the cookie', () => {
		const header = expireLoginCookie(APP_STATE_COOKIE);

		expect(header.startsWith(`${APP_STATE_COOKIE}=;`)).toBe(true);
		expect(header).toContain('Max-Age=0');
		expect(header).toContain('HttpOnly');
		expect(header).toContain('Secure');
		expect(header).toContain('SameSite=Lax');
		expect(header).toContain('Path=/');
	});
});

describe('getBackendSetCookies', () => {
	it('returns every Set-Cookie header the backend sent', () => {
		const headers = new Headers();
		headers.append('set-cookie', 'ham_session=1; Path=/');
		headers.append('set-cookie', 'ham_refresh=2; Path=/');

		expect(getBackendSetCookies(new Response(null, { headers }))).toEqual([
			'ham_session=1; Path=/',
			'ham_refresh=2; Path=/',
		]);
	});

	// Older runtimes (and hand-rolled Response stubs) have no
	// `getSetCookie`, which folds every cookie into one comma-joined
	// string. Returning nothing is safer than replaying that.
	it('returns an empty list when the runtime cannot split the header', () => {
		expect(
			getBackendSetCookies({ headers: {} } as unknown as Response)
		).toEqual([]);
	});
});

describe('callback constants', () => {
	it('points at the backend app-callback path', () => {
		expect(APP_CALLBACK_BACKEND_PATH).toBe('/web/auth/app-callback');
	});

	it('reuses the app login cookie pair', () => {
		expect(LOGIN_CALLBACK_COOKIES).toEqual({
			from: APP_FROM_COOKIE,
			state: APP_STATE_COOKIE,
		});
	});
});
