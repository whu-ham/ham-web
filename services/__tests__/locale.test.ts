/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for `getAcceptLanguageFromDocument` — the client-side
 * Accept-Language source shared by every `request()` call.
 *
 * The "no cookie" branch matters as much as the happy path: without an
 * explicit override the browser's own Accept-Language must win, so the
 * helper has to stay silent rather than send a guessed value.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAcceptLanguageFromDocument } from '@/services/locale';
import { LOCALE_COOKIE } from '@/services/cookies';

const withCookie = (cookie: string) => {
	vi.stubGlobal('document', { cookie });
};

describe('getAcceptLanguageFromDocument', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// The module is imported by server components too, where `document`
	// does not exist. Reading it unguarded would crash the SSR render.
	it('returns undefined when there is no document', () => {
		vi.stubGlobal('document', undefined);

		expect(getAcceptLanguageFromDocument()).toBeUndefined();
	});

	it('reads the locale cookie', () => {
		withCookie(`${LOCALE_COOKIE}=zh`);

		expect(getAcceptLanguageFromDocument()).toBe('zh');
	});

	it('reads the locale cookie from the middle of the jar', () => {
		withCookie(`ham_session=s; ${LOCALE_COOKIE}=ja; NEXT_THEME=dark`);

		expect(getAcceptLanguageFromDocument()).toBe('ja');
	});

	it('trims the whitespace the cookie jar adds around entries', () => {
		withCookie(`ham_session=s ;   ${LOCALE_COOKIE}=en   `);

		expect(getAcceptLanguageFromDocument()).toBe('en');
	});

	it('returns undefined when the locale cookie is absent', () => {
		withCookie('ham_session=s; NEXT_THEME=dark');

		expect(getAcceptLanguageFromDocument()).toBeUndefined();
	});

	// A cookie whose name merely ends with the locale cookie name must not
	// be mistaken for it — `startsWith` on the full `NAME=` prefix is what
	// keeps `XNEXT_LOCALE` out.
	it('ignores cookies that only end with the locale cookie name', () => {
		withCookie(`X${LOCALE_COOKIE}=ja`);

		expect(getAcceptLanguageFromDocument()).toBeUndefined();
	});

	it('decodes an URL-encoded value', () => {
		withCookie(`${LOCALE_COOKIE}=zh%2DCN`);

		expect(getAcceptLanguageFromDocument()).toBe('zh-CN');
	});

	// An empty override would send `Accept-Language: ` and make the
	// backend fall back to a default the user never chose.
	it('returns undefined for an empty value', () => {
		withCookie(`${LOCALE_COOKIE}=`);

		expect(getAcceptLanguageFromDocument()).toBeUndefined();
	});

	it('returns undefined for an empty cookie jar', () => {
		withCookie('');

		expect(getAcceptLanguageFromDocument()).toBeUndefined();
	});
});
