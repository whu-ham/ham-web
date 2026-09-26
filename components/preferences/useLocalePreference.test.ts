/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:25:00
 *
 * Unit tests for `useLocalePreference`.
 *
 * The hook decides whether the switcher shows "Follow browser" or the
 * language the user actually picked, and it is the only writer of the
 * `NEXT_LOCALE` cookie the server reads back — so a wrong decision is sticky
 * across reloads and a missing cookie write silently reverts the user's
 * choice on the next navigation. The tests therefore assert on the cookie
 * that ends up in `document.cookie` and on the reload the hook triggers,
 * not on internal state.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { Provider, createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCALE_COOKIE } from '@/i18n/config';

// `useLocale()` is the server-resolved locale; the hook only ever reads it.
const { localeRef } = vi.hoisted(() => ({
	localeRef: { current: 'zh' },
}));
vi.mock('next-intl', () => ({
	useLocale: () => localeRef.current,
}));

import {
	clearLocaleCookie,
	detectBrowserLocale,
	resolveAutoLabel,
	useLocalePreference,
	writeLocaleCookie,
} from '@/components/preferences/useLocalePreference';

const cookieValue = () =>
	document.cookie
		.split(';')
		.map((entry) => entry.trim())
		.find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
		?.slice(LOCALE_COOKIE.length + 1);

const setLocaleCookie = (value: string) => {
	document.cookie = `${LOCALE_COOKIE}=${value}; path=/`;
};

const dropLocaleCookie = () => {
	document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
};

const stubNavigator = (languages?: string[], language?: string) => {
	Object.defineProperty(navigator, 'languages', {
		configurable: true,
		value: languages,
	});
	Object.defineProperty(navigator, 'language', {
		configurable: true,
		value: language,
	});
};

const reload = vi.fn();
Object.defineProperty(window, 'location', {
	configurable: true,
	writable: true,
	value: { href: 'http://localhost/', origin: 'http://localhost', reload },
});

/** Every switcher instance in the tree shares one jotai store. */
const renderPreference = () => {
	const store = createStore();
	const wrapper = ({ children }: { children: React.ReactNode }) =>
		createElement(Provider, { store }, children);
	const rendered = renderHook(() => useLocalePreference(), { wrapper });
	return { ...rendered, store };
};

describe('components/preferences/useLocalePreference', () => {
	beforeEach(() => {
		localeRef.current = 'zh';
		reload.mockReset();
		dropLocaleCookie();
		window.localStorage.clear();
		stubNavigator(['en-US'], 'en-US');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('detectBrowserLocale', () => {
		it('matches a fully tagged language against the catalogue', () => {
			stubNavigator(['ja-JP', 'en-US'], 'ja-JP');

			expect(detectBrowserLocale()).toBe('ja');
		});

		it('falls back to the base subtag before giving up', () => {
			// `zh-HK` is Traditional Chinese, but the catalogue only ships
			// Simplified — the base tag is still the closest useful answer.
			stubNavigator(['zh-HK'], 'zh-HK');

			expect(detectBrowserLocale()).toBe('zh');
		});

		it('uses the single language when the list is missing', () => {
			stubNavigator(undefined, 'en-GB');

			expect(detectBrowserLocale()).toBe('en');
		});

		it('accepts a bare tag without looking for a base subtag', () => {
			stubNavigator(['ja', 'en'], 'ja');

			expect(detectBrowserLocale()).toBe('ja');
		});

		it('returns null when the browser reports no language at all', () => {
			stubNavigator(undefined, undefined);

			expect(detectBrowserLocale()).toBeNull();
		});

		it('returns null when nothing is supported', () => {
			stubNavigator(['fr-FR', 'de'], 'fr-FR');

			expect(detectBrowserLocale()).toBeNull();
		});

		it('returns null off the browser, where navigator does not exist', () => {
			vi.stubGlobal('navigator', undefined);

			expect(detectBrowserLocale()).toBeNull();
		});
	});

	describe('resolveAutoLabel', () => {
		it('names the detected language in its own language', () => {
			expect(resolveAutoLabel('ja', 'Follow browser')).toBe(
				'ブラウザに従う（日本語）'
			);
		});

		it('keeps the caller fallback when nothing was detected', () => {
			// An unsupported browser language must not render an empty
			// placeholder in the middle of the label.
			expect(resolveAutoLabel(null, 'Follow browser')).toBe('Follow browser');
		});
	});

	describe('cookie writers', () => {
		it('stores the pick in the cookie and mirrors it to localStorage', () => {
			writeLocaleCookie('ja');

			expect(cookieValue()).toBe('ja');
			expect(window.localStorage.getItem(LOCALE_COOKIE)).toBe('ja');
		});

		it('survives localStorage being unavailable', () => {
			vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
				throw new Error('denied');
			});

			expect(() => writeLocaleCookie('ja')).not.toThrow();
			expect(cookieValue()).toBe('ja');
		});

		it('expires the cookie and the mirror when going back to auto', () => {
			writeLocaleCookie('ja');
			clearLocaleCookie();

			expect(cookieValue()).toBeUndefined();
			expect(window.localStorage.getItem(LOCALE_COOKIE)).toBeNull();
		});

		it('still expires the cookie when the mirror refuses removal', () => {
			writeLocaleCookie('ja');
			vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
				throw new Error('denied');
			});

			expect(() => clearLocaleCookie()).not.toThrow();
			expect(cookieValue()).toBeUndefined();
		});
	});

	describe('useLocalePreference', () => {
		it('reports follow-browser and the detected language with no cookie', async () => {
			stubNavigator(['ja-JP'], 'ja-JP');
			const { result } = renderPreference();

			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));
			expect(result.current.browserLocale).toBe('ja');
		});

		it('leaves the detected locale null for an unsupported browser', async () => {
			stubNavigator(['fr-FR'], 'fr-FR');
			const { result } = renderPreference();

			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));
			// No detected language means the "Follow browser" entry keeps its
			// plain label instead of naming a language we do not ship.
			expect(result.current.browserLocale).toBeNull();
		});

		it('reports the active locale once the cookie holds a pick', async () => {
			localeRef.current = 'ja';
			setLocaleCookie('ja');
			const { result } = renderPreference();

			await waitFor(() => expect(result.current.selectedKey).toBe('ja'));
		});

		it('ignores a cookie holding a language we do not ship', async () => {
			setLocaleCookie('klingon');
			const { result } = renderPreference();

			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));
		});

		it('writes the cookie and reloads on an explicit pick', async () => {
			// The reload is what makes `useLocale()` report the new language,
			// so the assertion below already assumes the round trip happened.
			localeRef.current = 'ja';
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));

			act(() => {
				result.current.onSelectionChange('ja');
			});

			expect(cookieValue()).toBe('ja');
			expect(window.localStorage.getItem(LOCALE_COOKIE)).toBe('ja');
			// The server resolves the locale from the cookie, so the page
			// has to be re-rendered for the pick to take effect.
			expect(reload).toHaveBeenCalledTimes(1);
			await waitFor(() => expect(result.current.selectedKey).toBe('ja'));
		});

		it('skips the reload when the pick equals what the browser asked for', async () => {
			stubNavigator(['ja-JP'], 'ja-JP');
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.browserLocale).toBe('ja'));

			act(() => {
				result.current.onSelectionChange('ja');
			});

			// The rendered language does not change, so reloading would only
			// cost a round trip — but the cookie still has to be written.
			expect(cookieValue()).toBe('ja');
			expect(reload).not.toHaveBeenCalled();
		});

		it('does nothing when the pick is already the active locale', async () => {
			localeRef.current = 'zh';
			setLocaleCookie('zh');
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('zh'));

			act(() => {
				result.current.onSelectionChange('zh');
			});

			expect(reload).not.toHaveBeenCalled();
			expect(cookieValue()).toBe('zh');
		});

		it('clears the cookie and reloads when going back to follow-browser', async () => {
			localeRef.current = 'ja';
			setLocaleCookie('ja');
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('ja'));

			act(() => {
				result.current.onSelectionChange('auto');
			});

			expect(cookieValue()).toBeUndefined();
			expect(window.localStorage.getItem(LOCALE_COOKIE)).toBeNull();
			expect(reload).toHaveBeenCalledTimes(1);
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));
		});

		it('does nothing when auto is picked while already following', async () => {
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));

			act(() => {
				result.current.onSelectionChange('auto');
			});

			expect(reload).not.toHaveBeenCalled();
		});

		it('ignores a key that is neither auto nor a shipped locale', async () => {
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));

			act(() => {
				result.current.onSelectionChange('klingon');
			});

			expect(cookieValue()).toBeUndefined();
			expect(reload).not.toHaveBeenCalled();
			expect(result.current.selectedKey).toBe('auto');
		});

		it('mirrors a pick into the other mounted switchers', async () => {
			// The header renders the desktop pair and the compact user menu
			// at once; a pick in one must not leave the other on "auto".
			const store = createStore();
			localeRef.current = 'ja';
			const wrapper = ({ children }: { children: React.ReactNode }) =>
				createElement(Provider, { store }, children);
			const first = renderHook(() => useLocalePreference(), { wrapper });
			const second = renderHook(() => useLocalePreference(), {
				wrapper,
			});
			await waitFor(() =>
				expect(first.result.current.selectedKey).toBe('auto')
			);

			act(() => {
				first.result.current.onSelectionChange('ja');
			});

			await waitFor(() => expect(second.result.current.selectedKey).toBe('ja'));
			expect(second.result.current.browserLocale).toBe('en');
		});
	});
});
