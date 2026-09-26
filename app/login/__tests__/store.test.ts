/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 21:05:00
 *
 * Unit tests for the /login page atoms.
 *
 * `APP_CALLBACK_PATH` is pinned because it is not just a route: it has to
 * stay the path registered with the backend's allowed redirect URIs and
 * the one the app is launched with, so a rename here silently breaks every
 * app login.
 *
 * The atoms are pinned at their defaults because both are read before any
 * event fires — the render must match the server. `loginSucceededAtom` is
 * the signal that moves a completed QR / passkey login on to the
 * destination, and `mobileAtom` decides which layout the page renders.
 */
import { describe, expect, it } from 'vitest';

import { createStore } from 'jotai';

import {
	APP_CALLBACK_PATH,
	loginSucceededAtom,
	mobileAtom,
} from '@/app/login/store';

describe('app/login/store', () => {
	it('points the app callback at the route that handles it', () => {
		// Registered with the backend as an allowed redirect URI, so the
		// value has to stay a site-root-relative path.
		expect(APP_CALLBACK_PATH).toBe('/login/callback');
		expect(APP_CALLBACK_PATH.startsWith('/')).toBe(true);
		expect(APP_CALLBACK_PATH.endsWith('/')).toBe(false);
	});

	it('starts unsignalled so the page matches the server render', () => {
		expect(createStore().get(loginSucceededAtom)).toBe(false);
	});

	it('flips to succeeded once a login completes', () => {
		const store = createStore();

		store.set(loginSucceededAtom, true);

		expect(store.get(loginSucceededAtom)).toBe(true);
	});

	it('starts non-mobile and follows the device', () => {
		const store = createStore();
		expect(store.get(mobileAtom)).toBe(false);

		store.set(mobileAtom, true);

		expect(store.get(mobileAtom)).toBe(true);
	});

	// The two signals are independent: a mobile device must not look like a
	// finished login.
	it('keeps the two atoms independent', () => {
		const store = createStore();

		store.set(mobileAtom, true);

		expect(store.get(loginSucceededAtom)).toBe(false);
	});
});
