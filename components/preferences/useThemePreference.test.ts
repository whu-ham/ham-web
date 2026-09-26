/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:27:00
 *
 * Unit tests for `useThemePreference`.
 *
 * The hook owns the only two things the browser can see before React has
 * rendered: the `dark`/`light` class pair on `<html>` (which every palette
 * rule keys off) and the `<meta name="theme-color">` entry that colours the
 * browser chrome. Getting the meta ordering wrong hands the OS back control
 * of the strip above the page, and forgetting to drop the entry when the
 * user returns to "follow system" freezes it on the abandoned palette — so
 * the tests assert on the real `<head>` and `<html>` rather than on the
 * returned state alone.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { Provider, createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_COLOR, THEME_COOKIE } from '@/components/theme/config';
import {
	applyThemeColor,
	applyThemeToDocument,
	useThemePreference,
} from '@/components/preferences/useThemePreference';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

let systemPrefersDark = false;
let mediaListeners = new Set<() => void>();
let matchMedia: undefined | (() => MediaQueryList);

/** jsdom ships no `matchMedia`, so the hook's OS probe needs one. */
const stubMatchMedia = (matches: boolean) => {
	systemPrefersDark = matches;
	mediaListeners = new Set();
	const mql = {
		get matches() {
			return systemPrefersDark;
		},
		addEventListener: (_event: string, cb: () => void) => {
			mediaListeners.add(cb);
		},
		removeEventListener: (_event: string, cb: () => void) => {
			mediaListeners.delete(cb);
		},
	};
	matchMedia = vi.fn(() => mql as unknown as MediaQueryList);
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: matchMedia,
	});
};

/** The OS flips; the listener has to notice without a reload. */
const flipSystem = (matches: boolean) => {
	systemPrefersDark = matches;
	mediaListeners.forEach((cb) => cb());
};

const themeColorMetas = () =>
	Array.from(document.head.querySelectorAll('meta[name="theme-color"]'));

const plainThemeColorMeta = () =>
	themeColorMetas().find((meta) => !meta.getAttribute('media'));

const addMediaMeta = (content: string, media: string) => {
	const meta = document.createElement('meta');
	meta.setAttribute('name', 'theme-color');
	meta.setAttribute('content', content);
	meta.setAttribute('media', media);
	document.head.appendChild(meta);
	return meta;
};

const cookieValue = () =>
	document.cookie
		.split(';')
		.map((entry) => entry.trim())
		.find((entry) => entry.startsWith(`${THEME_COOKIE}=`))
		?.slice(THEME_COOKIE.length + 1);

const renderPreference = () => {
	const store = createStore();
	const wrapper = ({ children }: { children: React.ReactNode }) =>
		createElement(Provider, { store }, children);
	return renderHook(() => useThemePreference(), { wrapper });
};

describe('components/preferences/useThemePreference', () => {
	beforeEach(() => {
		stubMatchMedia(false);
		document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
		window.localStorage.clear();
		document.head
			.querySelectorAll('meta[name="theme-color"]')
			.forEach((meta) => meta.remove());
		document.documentElement.className = '';
		document.documentElement.removeAttribute('data-theme');
		document.documentElement.style.colorScheme = '';
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('applyThemeToDocument', () => {
		it('writes the class, the data attribute and the colour scheme', () => {
			applyThemeToDocument('dark');

			const root = document.documentElement;
			// HeroUI v3 needs both hooks, so a palette fix that writes only
			// one of them would silently half-apply.
			expect(root.classList.contains('dark')).toBe(true);
			expect(root.getAttribute('data-theme')).toBe('dark');
			expect(root.style.colorScheme).toBe('dark');
		});

		it('drops the opposite class instead of stacking both', () => {
			applyThemeToDocument('dark');
			applyThemeToDocument('light');

			const root = document.documentElement;
			expect(root.classList.contains('dark')).toBe(false);
			expect(root.classList.contains('light')).toBe(true);
			expect(root.getAttribute('data-theme')).toBe('light');
		});

		it('does nothing when there is no document to write to', () => {
			vi.stubGlobal('document', undefined);

			expect(() => applyThemeToDocument('dark')).not.toThrow();
		});
	});

	describe('applyThemeColor', () => {
		it('adds the entry when the head has none', () => {
			applyThemeColor('dark');

			expect(themeColorMetas()).toHaveLength(1);
			expect(plainThemeColorMeta()?.getAttribute('content')).toBe(
				THEME_COLOR.dark
			);
		});

		it('places the entry ahead of every media-scoped one', () => {
			// Tree order decides the winner: an unconditional entry appended
			// after the media query would never be picked up.
			addMediaMeta(THEME_COLOR.light, '(prefers-color-scheme: light)');
			applyThemeColor('dark');

			const [first] = themeColorMetas();
			expect(first.getAttribute('media')).toBeNull();
			expect(first.getAttribute('content')).toBe(THEME_COLOR.dark);
		});

		it('rewrites the existing entry rather than adding a second', () => {
			applyThemeColor('dark');
			applyThemeColor('light');

			expect(themeColorMetas()).toHaveLength(1);
			expect(plainThemeColorMeta()?.getAttribute('content')).toBe(
				THEME_COLOR.light
			);
		});

		it('removes the entry when the user returns to follow system', () => {
			applyThemeColor('dark');
			applyThemeColor(null);

			// The media-scoped entries resume tracking the OS from here.
			expect(themeColorMetas()).toHaveLength(0);
		});

		it('leaves media-scoped entries alone when clearing', () => {
			applyThemeColor('dark');
			const mediaMeta = addMediaMeta(
				THEME_COLOR.light,
				'(prefers-color-scheme: light)'
			);
			applyThemeColor(null);

			expect(themeColorMetas()).toEqual([mediaMeta]);
		});

		it('does nothing when there is no entry to remove', () => {
			expect(() => applyThemeColor(null)).not.toThrow();
			expect(themeColorMetas()).toHaveLength(0);
		});

		it('does nothing when there is no document to write to', () => {
			vi.stubGlobal('document', undefined);

			expect(() => applyThemeColor('dark')).not.toThrow();
			expect(() => applyThemeColor(null)).not.toThrow();
		});
	});

	describe('useThemePreference', () => {
		it('follows the system while no cookie is stored', async () => {
			stubMatchMedia(true);
			const { result } = renderPreference();

			await waitFor(() =>
				expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
			);
			expect(matchMedia).toHaveBeenCalledWith(MEDIA_QUERY);
			expect(result.current.selectedKey).toBe('auto');
			// No concrete pick, so no unconditional entry may outrank the
			// media-scoped ones the server rendered.
			expect(plainThemeColorMeta()).toBeUndefined();
		});

		it('paints the palette the cookie asks for', async () => {
			document.cookie = `${THEME_COOKIE}=dark; path=/`;
			const { result } = renderPreference();

			await waitFor(() => expect(result.current.selectedKey).toBe('dark'));
			expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		});

		it('ignores a cookie holding something outside the catalogue', async () => {
			document.cookie = `${THEME_COOKIE}=sepia; path=/`;
			const { result } = renderPreference();

			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));
			expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		});

		it('assumes a light OS where matchMedia is missing', async () => {
			Object.defineProperty(window, 'matchMedia', {
				configurable: true,
				writable: true,
				value: undefined,
			});
			const { result } = renderPreference();

			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));
			expect(document.documentElement.getAttribute('data-theme')).toBe('light');
			expect(mediaListeners.size).toBe(0);
		});

		it('stops tracking the OS once unmounted', async () => {
			const { result, unmount } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));
			expect(mediaListeners.size).toBe(1);

			unmount();
			expect(mediaListeners.size).toBe(0);
			flipSystem(true);

			expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		});

		it('re-paints when the OS flips while following it', async () => {
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));

			act(() => {
				flipSystem(true);
			});

			await waitFor(() =>
				expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
			);
			expect(result.current.selectedKey).toBe('auto');
		});

		it('keeps the explicit pick when the OS flips', async () => {
			document.cookie = `${THEME_COOKIE}=light; path=/`;
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('light'));

			act(() => {
				flipSystem(true);
			});

			expect(document.documentElement.getAttribute('data-theme')).toBe('light');
			expect(result.current.selectedKey).toBe('light');
		});

		it('persists an explicit pick to the cookie and the chrome', async () => {
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));

			act(() => {
				result.current.onSelectionChange('dark');
			});

			expect(cookieValue()).toBe('dark');
			expect(window.localStorage.getItem(THEME_COOKIE)).toBe('dark');
			expect(plainThemeColorMeta()?.getAttribute('content')).toBe(
				THEME_COLOR.dark
			);
			await waitFor(() => expect(result.current.selectedKey).toBe('dark'));
			expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		});

		it('rewrites the chrome entry when the pick changes', async () => {
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));

			act(() => {
				result.current.onSelectionChange('dark');
			});
			act(() => {
				result.current.onSelectionChange('light');
			});

			expect(themeColorMetas()).toHaveLength(1);
			expect(plainThemeColorMeta()?.getAttribute('content')).toBe(
				THEME_COLOR.light
			);
			expect(cookieValue()).toBe('light');
		});

		it('drops the cookie and the chrome entry on follow system', async () => {
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));

			act(() => {
				result.current.onSelectionChange('dark');
			});
			await waitFor(() => expect(result.current.selectedKey).toBe('dark'));

			act(() => {
				result.current.onSelectionChange('auto');
			});

			expect(cookieValue()).toBeUndefined();
			expect(window.localStorage.getItem(THEME_COOKIE)).toBeNull();
			expect(themeColorMetas()).toHaveLength(0);
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));
		});

		it('ignores a key that is neither auto nor a shipped theme', async () => {
			const { result } = renderPreference();
			await waitFor(() => expect(result.current.selectedKey).toBe('auto'));

			act(() => {
				result.current.onSelectionChange('sepia');
			});

			expect(cookieValue()).toBeUndefined();
			expect(themeColorMetas()).toHaveLength(0);
			expect(result.current.selectedKey).toBe('auto');
		});

		it('mirrors a pick made in one switcher into the other', async () => {
			// The header renders the desktop switcher and the compact user
			// menu at once; the shared atom is what keeps them in step, so a
			// pick in one must not leave the other on "follow system".
			const store = createStore();
			const wrapper = ({ children }: { children: React.ReactNode }) =>
				createElement(Provider, { store }, children);
			const header = renderHook(() => useThemePreference(), { wrapper });
			const menu = renderHook(() => useThemePreference(), { wrapper });
			await waitFor(() =>
				expect(header.result.current.selectedKey).toBe('auto')
			);

			act(() => {
				header.result.current.onSelectionChange('dark');
			});

			await waitFor(() => expect(menu.result.current.selectedKey).toBe('dark'));
			expect(cookieValue()).toBe('dark');
		});
	});
});
