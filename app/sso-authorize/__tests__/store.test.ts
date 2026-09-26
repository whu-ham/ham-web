/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the /sso-authorize jotai atoms — above all the derived
 * `deepLinkUrlAtom`, which is the only thing standing between the page and a
 * hand-off to the native app.
 *
 * Before the URL has been parsed the atom has to be an empty string. A
 * `ham://sso-authorize` link built from `null` params would hand the app a
 * request without a `client_id`, and the user would land on a dead screen
 * instead of the consent page. Once the params exist, every field the app
 * needs in order to resume the OAuth flow has to be mirrored into the link —
 * including the fact that an absent scope or state must be omitted rather
 * than serialised as an empty value the app would reject.
 *
 * The atoms are read through `useAtomValue` rather than `store.get` so the
 * tests prove a component actually re-renders when the params land.
 */
import { act, renderHook } from '@testing-library/react';
import { Provider, createStore, useAtomValue } from 'jotai';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
	deepLinkUrlAtom,
	deviceKindAtom,
	paramsAtom,
	stageAtom,
	type SsoAuthorizeParams,
} from '@/app/sso-authorize/store';

const PARAMS: SsoAuthorizeParams = {
	appId: 'app-1',
	scope: ['openid', 'profile'],
	state: 'st-1',
	redirectUri: 'https://app.example.com/cb',
};

const wrap = (store: ReturnType<typeof createStore>) => {
	const Wrapper = ({ children }: { children: ReactNode }) =>
		createElement(Provider, { store }, children);
	return Wrapper;
};

describe('sso-authorize atoms', () => {
	it('starts in the loading stage on desktop with no params', () => {
		const store = createStore();

		expect(store.get(paramsAtom)).toBeNull();
		expect(store.get(stageAtom)).toEqual({ kind: 'loading' });
		expect(store.get(deviceKindAtom)).toBe('desktop');
	});

	it('keeps the deep-link URL empty until the parsed params arrive', () => {
		const store = createStore();
		const { result } = renderHook(() => useAtomValue(deepLinkUrlAtom), {
			wrapper: wrap(store),
		});

		expect(result.current).toBe('');

		act(() => {
			store.set(paramsAtom, PARAMS);
		});

		expect(result.current).toBe(
			'ham://sso-authorize?client_id=app-1&scope=openid+profile&state=st-1' +
				'&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb'
		);
	});

	it('omits scope and state from the deep link when the request had none', () => {
		const store = createStore();
		const { result } = renderHook(() => useAtomValue(deepLinkUrlAtom), {
			wrapper: wrap(store),
		});

		act(() => {
			store.set(paramsAtom, { ...PARAMS, scope: [], state: '' });
		});

		expect(result.current).toBe(
			'ham://sso-authorize?client_id=app-1' +
				'&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb'
		);
	});

	it('publishes the stage and device kind to every reader of the store', () => {
		const store = createStore();
		const { result } = renderHook(
			() => ({
				stage: useAtomValue(stageAtom),
				deviceKind: useAtomValue(deviceKindAtom),
			}),
			{ wrapper: wrap(store) }
		);

		expect(result.current.stage).toEqual({ kind: 'loading' });
		expect(result.current.deviceKind).toBe('desktop');

		act(() => {
			store.set(stageAtom, {
				kind: 'deep-link-fallback',
				authenticated: false,
			});
			store.set(deviceKindAtom, 'ios');
		});

		expect(result.current.stage).toEqual({
			kind: 'deep-link-fallback',
			authenticated: false,
		});
		expect(result.current.deviceKind).toBe('ios');
	});
});
