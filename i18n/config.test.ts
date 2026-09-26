/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:29:00
 *
 * Unit tests for the locale catalogue.
 *
 * `isLocale` is the guard in front of every locale write: the cookie is
 * user-writable and `Accept-Language` is client-supplied, so a value that
 * slips through would be fed to a dynamic import path and to the `lang`
 * attribute. The rest of the module is the contract the switcher and the
 * server share, so a renamed cookie or a missing `lang` tag is a
 * breakage the whole app feels.
 */
import { describe, expect, it } from 'vitest';

import {
	DEFAULT_LOCALE,
	HTML_LANG,
	LOCALE_COOKIE,
	LOCALE_LABELS,
	LOCALES,
	isLocale,
} from '@/i18n/config';

describe('i18n/config', () => {
	it('accepts exactly the locales that have a catalogue', () => {
		for (const locale of LOCALES) {
			expect(isLocale(locale)).toBe(true);
		}
	});

	it('rejects absent and unknown values', () => {
		expect(isLocale(undefined)).toBe(false);
		expect(isLocale(null)).toBe(false);
		expect(isLocale('')).toBe(false);
		expect(isLocale('de')).toBe(false);
		expect(isLocale(3 as unknown as string)).toBe(false);
	});

	it('does not normalise case or whitespace', () => {
		// Both inputs come from outside the app, and neither the language
		// switcher nor the request config trims them first.
		expect(isLocale('ZH')).toBe(false);
		expect(isLocale(' zh')).toBe(false);
	});

	it('defaults to Simplified Chinese', () => {
		expect(DEFAULT_LOCALE).toBe('zh');
		expect(isLocale(DEFAULT_LOCALE)).toBe(true);
	});

	it('persists the pick under the cookie the server reads back', () => {
		expect(LOCALE_COOKIE).toBe('NEXT_LOCALE');
	});

	it('labels every locale in its own language', () => {
		expect(LOCALE_LABELS).toEqual({
			zh: '简体中文',
			en: 'English',
			ja: '日本語',
		});
		expect(Object.keys(LOCALE_LABELS).sort()).toEqual([...LOCALES].sort());
	});

	it('maps every locale to an html lang attribute', () => {
		expect(HTML_LANG).toEqual({ zh: 'zh-CN', en: 'en', ja: 'ja' });
		expect(Object.keys(HTML_LANG).sort()).toEqual([...LOCALES].sort());
	});
});
