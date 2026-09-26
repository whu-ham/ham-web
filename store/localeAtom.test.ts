/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:24:00
 *
 * Unit tests for the locale override flag.
 *
 * The flag is what tells every mounted language switcher "the cookie is
 * set, so `useLocale()` is the user's pick" — it is read before hydration,
 * so its default has to match the server render exactly or the header
 * flashes "Follow browser" on every load. Writes come from whichever
 * switcher the user clicked, so the tests pin both transitions and confirm
 * the flag lives in the store, not in module state shared across renders.
 */
import { describe, expect, it } from 'vitest';

import { createStore } from 'jotai';

import { localeOverrideAtom } from '@/store/localeAtom';

describe('store/localeAtom', () => {
	it('starts unset so the client matches the server render', () => {
		expect(localeOverrideAtom.debugLabel).toBe('localeOverride');
		expect(createStore().get(localeOverrideAtom)).toBe(false);
	});

	it('flips to set once the switcher writes the cookie', () => {
		const store = createStore();

		store.set(localeOverrideAtom, true);

		expect(store.get(localeOverrideAtom)).toBe(true);
	});

	it('flips back when the cookie is cleared for follow-browser', () => {
		const store = createStore();
		store.set(localeOverrideAtom, true);

		store.set(localeOverrideAtom, false);

		expect(store.get(localeOverrideAtom)).toBe(false);
	});

	it('keeps one store flag out of another', () => {
		// Each test render gets its own store, so a pick made in one tree
		// must not leak into a sibling that never saw the cookie.
		const first = createStore();
		const second = createStore();

		first.set(localeOverrideAtom, true);

		expect(second.get(localeOverrideAtom)).toBe(false);
	});
});
