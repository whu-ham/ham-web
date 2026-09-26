/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:23:00
 *
 * Unit tests for the theme atoms.
 *
 * The cookie is the only thing that survives a reload, and it is written
 * from inside the atom's write function — so a broken write leaves the UI
 * showing a palette the next visit cannot reproduce. These tests drive the
 * atoms through a real jotai store and assert on what landed in
 * `document.cookie`, which is the observable contract, plus the two
 * "can't detect the OS" fallbacks (`detectSystemTheme` runs at module load,
 * so each case needs its own fresh import).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_COOKIE } from '@/components/theme/config';

type Atoms = typeof import('@/store/themeAtom');

const cookieValue = () =>
	document.cookie
		.split(';')
		.map((entry) => entry.trim())
		.find((entry) => entry.startsWith(`${THEME_COOKIE}=`))
		?.slice(THEME_COOKIE.length + 1);

/** jsdom has no `matchMedia`; every case installs its own. */
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

// `detectSystemTheme()` runs while the module is being evaluated, so the
// environment has to be in place before the import, not after it.
const importAtoms = async (): Promise<Atoms> => {
	vi.resetModules();
	return import('@/store/themeAtom');
};

describe('store/themeAtom', () => {
	beforeEach(() => {
		stubMatchMedia(undefined);
		document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
		window.localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('systemThemeAtom', () => {
		it('reads a dark OS preference at module load', async () => {
			stubMatchMedia(true);
			const { systemThemeAtom } = await importAtoms();
			const { createStore } = await import('jotai');
			const store = createStore();

			expect(systemThemeAtom.debugLabel).toBe('systemTheme');
			expect(store.get(systemThemeAtom)).toBe('dark');
		});

		it('reads a light OS preference at module load', async () => {
			stubMatchMedia(false);
			const { systemThemeAtom } = await importAtoms();
			const { createStore } = await import('jotai');

			expect(createStore().get(systemThemeAtom)).toBe('light');
		});

		it('assumes light when the browser has no matchMedia', async () => {
			stubMatchMedia(undefined);
			const { systemThemeAtom } = await importAtoms();
			const { createStore } = await import('jotai');

			expect(createStore().get(systemThemeAtom)).toBe('light');
		});

		it('assumes light when there is no window at all', async () => {
			// The server render takes this path: no window, no media query,
			// and it must match the client default or hydration complains.
			vi.stubGlobal('window', undefined);
			const { systemThemeAtom } = await importAtoms();
			const { createStore } = await import('jotai');

			expect(createStore().get(systemThemeAtom)).toBe('light');
		});
	});

	describe('themeOverrideAtom', () => {
		it('starts empty so the first client render matches the server', async () => {
			const { themeOverrideAtom } = await importAtoms();
			const { createStore } = await import('jotai');

			expect(createStore().get(themeOverrideAtom)).toBeNull();
		});

		it('persists an explicit pick to the cookie and localStorage', async () => {
			const { themeOverrideAtom } = await importAtoms();
			const { createStore } = await import('jotai');
			const store = createStore();

			store.set(themeOverrideAtom, 'dark');

			expect(cookieValue()).toBe('dark');
			expect(window.localStorage.getItem(THEME_COOKIE)).toBe('dark');
			expect(store.get(themeOverrideAtom)).toBe('dark');
		});

		it('clears the cookie when the user goes back to follow system', async () => {
			const { themeOverrideAtom } = await importAtoms();
			const { createStore } = await import('jotai');
			const store = createStore();
			store.set(themeOverrideAtom, 'dark');
			expect(cookieValue()).toBe('dark');

			store.set(themeOverrideAtom, null);

			// max-age=0 removes it, so a reload re-resolves from the OS.
			expect(cookieValue()).toBeUndefined();
			expect(window.localStorage.getItem(THEME_COOKIE)).toBeNull();
			expect(store.get(themeOverrideAtom)).toBeNull();
		});

		it('keeps the cookie write usable when private mode blocks storage', async () => {
			const { themeOverrideAtom } = await importAtoms();
			const { createStore } = await import('jotai');
			vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
				throw new Error('denied');
			});

			// The cookie is the primary store; localStorage is only a mirror,
			// so a throw there must surface as a silent no-op.
			expect(() => createStore().set(themeOverrideAtom, 'light')).not.toThrow();
			expect(cookieValue()).toBe('light');
		});

		it('still expires the cookie when the storage mirror refuses', async () => {
			const { themeOverrideAtom } = await importAtoms();
			const { createStore } = await import('jotai');
			const store = createStore();
			store.set(themeOverrideAtom, 'dark');
			vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
				throw new Error('denied');
			});

			expect(() => store.set(themeOverrideAtom, null)).not.toThrow();
			expect(cookieValue()).toBeUndefined();
		});

		it('does not leak one pick into another store', async () => {
			const { themeOverrideAtom } = await importAtoms();
			const { createStore } = await import('jotai');
			const storeA = createStore();
			const storeB = createStore();

			storeA.set(themeOverrideAtom, 'dark');

			expect(storeB.get(themeOverrideAtom)).toBeNull();
		});
	});

	describe('resolvedThemeAtom', () => {
		it('follows the system until an override is written', async () => {
			const { resolvedThemeAtom, systemThemeAtom, themeOverrideAtom } =
				await importAtoms();
			const { createStore } = await import('jotai');
			const store = createStore();
			store.set(systemThemeAtom, 'dark');

			expect(store.get(resolvedThemeAtom)).toBe('dark');

			store.set(themeOverrideAtom, 'light');
			expect(store.get(resolvedThemeAtom)).toBe('light');
		});

		it('falls back to the system theme as soon as the override is dropped', async () => {
			const { resolvedThemeAtom, systemThemeAtom, themeOverrideAtom } =
				await importAtoms();
			const { createStore } = await import('jotai');
			const store = createStore();
			store.set(systemThemeAtom, 'light');
			store.set(themeOverrideAtom, 'dark');
			expect(store.get(resolvedThemeAtom)).toBe('dark');

			store.set(themeOverrideAtom, null);

			expect(store.get(resolvedThemeAtom)).toBe('light');
		});
	});
});
