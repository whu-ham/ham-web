/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:21:41
 *
 * Unit tests for the shared theme catalogue.
 *
 * Two things here actually carry risk. `isTheme` gates every write of the
 * `NEXT_THEME` cookie, so a value that slips through as "valid" would be
 * applied to `<html>` as a class and silently break every palette rule.
 * `THEME_BOOTSTRAP_SCRIPT` is the one piece of code that runs before React
 * exists: it decides the palette of the very first paint, and a throw inside
 * it would leave the page unstyled — so the tests execute the script itself
 * against a stubbed browser rather than asserting on the string.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DEFAULT_SERVER_THEME,
	THEME_BOOTSTRAP_SCRIPT,
	THEME_CLASSES,
	THEME_COLOR,
	THEME_COOKIE,
	THEMES,
	isTheme,
} from '@/components/theme/config';

/** Runs the inline bootstrap exactly as the browser would. */
const runBootstrap = () => {
	// The script is injected with `dangerouslySetInnerHTML`, so it has no
	// closure scope to borrow from — evaluating it as a function body is
	// the same thing the HTML parser does.
	new Function(THEME_BOOTSTRAP_SCRIPT)();
};

const setCookie = (value: string) => {
	document.cookie = `${THEME_COOKIE}=${value}; path=/`;
};

const dropCookie = () => {
	document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
};

/** jsdom ships no `matchMedia`; the bootstrap probes for it anyway. */
const stubMatchMedia = (matches: boolean | undefined) => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value:
			matches === undefined
				? undefined
				: vi.fn(() => ({ matches }) as unknown as MediaQueryList),
	});
};

describe('components/theme/config', () => {
	afterEach(() => {
		dropCookie();
		window.localStorage.clear();
		document.documentElement.className = '';
		document.documentElement.removeAttribute('data-theme');
		document.documentElement.style.colorScheme = '';
		vi.restoreAllMocks();
	});

	describe('isTheme', () => {
		it('accepts exactly the catalogue it guards', () => {
			expect(THEMES).toEqual(['light', 'dark']);
			expect(isTheme('light')).toBe(true);
			expect(isTheme('dark')).toBe(true);
		});

		it('rejects absent, mis-cased and unknown values', () => {
			expect(isTheme(undefined)).toBe(false);
			expect(isTheme(null)).toBe(false);
			expect(isTheme('')).toBe(false);
			// Cookie values are attacker-writable, so the guard must not
			// normalise case or trim: only the exact tokens count.
			expect(isTheme('Dark')).toBe(false);
			expect(isTheme('sepia')).toBe(false);
			expect(isTheme(42 as unknown as string)).toBe(false);
		});
	});

	it('maps every theme to the class and chrome tint the UI expects', () => {
		expect(DEFAULT_SERVER_THEME).toBe('light');
		expect(THEME_CLASSES).toEqual({ light: 'light', dark: 'dark' });
		// Mirrors HeroUI's `--surface` token, the base of every header.
		expect(THEME_COLOR).toEqual({ light: '#ffffff', dark: '#18181b' });
	});

	describe('THEME_BOOTSTRAP_SCRIPT', () => {
		beforeEach(() => {
			stubMatchMedia(undefined);
		});

		it('paints the cookie choice before the first render', () => {
			setCookie('dark');
			runBootstrap();

			const root = document.documentElement;
			expect(root.classList.contains('dark')).toBe(true);
			expect(root.classList.contains('light')).toBe(false);
			expect(root.getAttribute('data-theme')).toBe('dark');
			expect(root.style.colorScheme).toBe('dark');
		});

		it('falls back to localStorage when the cookie is gone', () => {
			// A cookie set over HTTP on localhost can be evicted while the
			// localStorage mirror survives; the script must still find it.
			window.localStorage.setItem(THEME_COOKIE, 'dark');
			runBootstrap();

			expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		});

		it('ignores a cookie holding something outside the catalogue', () => {
			setCookie('sepia');
			runBootstrap();

			// Nothing to fall back to (no matchMedia either), so the script
			// must land on the same light default the server rendered.
			expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		});

		it('follows the OS when no preference is stored', () => {
			stubMatchMedia(true);
			runBootstrap();

			expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
		});

		it('prefers an explicit cookie over a dark OS', () => {
			stubMatchMedia(true);
			setCookie('light');
			runBootstrap();

			expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		});

		it('survives a localStorage read that private mode blocks', () => {
			// Safari in private mode throws on access; the inner try/catch
			// keeps the OS fallback reachable instead of aborting.
			vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
				throw new Error('denied');
			});
			runBootstrap();

			expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		});

		it('swaps the stale class off the root, never stacking both', () => {
			document.documentElement.classList.add('light');
			setCookie('dark');
			runBootstrap();

			expect(document.documentElement.classList.contains('light')).toBe(false);
			expect(document.documentElement.classList.contains('dark')).toBe(true);
		});
	});
});
