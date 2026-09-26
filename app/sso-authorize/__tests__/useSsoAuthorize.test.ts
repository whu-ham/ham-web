/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:35:00
 *
 * Unit tests for useSsoAuthorize — the orchestrator behind /sso-authorize.
 *
 * Everything this hook decides is a fork in the user's journey: a request
 * without a `client_id` must never leave the loading stage, an anonymous
 * desktop visitor has to be bounced to /login (with the original URL
 * preserved so sign-in can return them), and on mobile the app hand-off has
 * to be attempted exactly once — a second `ham://` launch would yank the
 * user out of the browser again after they already came back to finish the
 * flow in the tab. The tests pin those forks, the deep-link payload handed
 * to the launcher, and the visibility-driven session refresh that keeps a
 * long-lived consent tab from silently expiring.
 *
 * Boundaries are mocked (router, deep-link launcher, the BFF refresh call);
 * the URL parsing, device detection, atom plumbing and stage machine all run
 * for real behind the hook's public API.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { paramsAtom } from '@/app/sso-authorize/store';
import { useSsoAuthorize } from '@/app/sso-authorize/useSsoAuthorize';
import { ApiError, type MeResponse, WebAuthApi } from '@/services/sso/api';

// `useRouter` must hand back the SAME object on every render: the real
// router is stable, and the hook memoises callbacks on it. A fresh object
// per render changes `redirectToLogin`'s identity, which re-runs the stage
// effect and re-sets the stage atom forever.
const { routerPush, router } = vi.hoisted(() => {
	const routerPush = vi.fn();
	return {
		routerPush,
		router: {
			push: routerPush,
			replace: vi.fn(),
			refresh: vi.fn(),
			back: vi.fn(),
			forward: vi.fn(),
			prefetch: vi.fn(),
		},
	};
});
const { launchDeepLink } = vi.hoisted(() => ({ launchDeepLink: vi.fn() }));

vi.mock('next/navigation', () => ({
	useRouter: () => router,
}));

// Only the launcher is stubbed — `buildSsoAuthorizeDeepLink` is the code
// under test's source of truth for the `ham://` URL, so it stays real.
vi.mock('@/services/sso/deepLink', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/services/sso/deepLink')>()),
	tryLaunchDeepLink: launchDeepLink,
}));

const DESKTOP_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
	'(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const IOS_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
	'(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const REDIRECT_URI = 'https://app.example.com/cb';

const ME: MeResponse = { user_id: 'u-1', nickname: 'Ada' };
const OTHER_ME: MeResponse = { user_id: 'u-2', nickname: 'Bob' };

const query = (params: Record<string, string>) =>
	`?${new URLSearchParams(params).toString()}`;

const setUrl = (search: string) => {
	window.history.replaceState({}, '', `/sso-authorize${search}`);
};

const setUserAgent = (ua: string) => {
	Object.defineProperty(navigator, 'userAgent', {
		value: ua,
		configurable: true,
		writable: true,
	});
};

const setHidden = (hidden: boolean) => {
	Object.defineProperty(document, 'hidden', {
		value: hidden,
		configurable: true,
		writable: true,
	});
};

const wrap = (store: ReturnType<typeof createStore>) => {
	const Wrapper = ({ children }: { children: ReactNode }) =>
		createElement(Provider, { store }, children);
	return Wrapper;
};

let refreshSpy: MockInstance<typeof WebAuthApi.refresh>;
let dateNowSpy: MockInstance<typeof Date.now> | undefined;
let navigatorDescriptor: PropertyDescriptor | undefined;

const renderAuthorize = (me: MeResponse | null = null) => {
	const store = createStore();
	const view = renderHook(
		({ currentMe }: { currentMe: MeResponse | null }) =>
			useSsoAuthorize(currentMe),
		{
			initialProps: { currentMe: me },
			wrapper: wrap(store),
		}
	);
	return { ...view, store };
};

const focusTab = async () => {
	await act(async () => {
		document.dispatchEvent(new Event('visibilitychange'));
		await Promise.resolve();
	});
};

beforeEach(() => {
	routerPush.mockReset();
	launchDeepLink.mockReset();
	launchDeepLink.mockResolvedValue({ launched: false });
	setUserAgent(DESKTOP_UA);
	setHidden(false);
	refreshSpy = vi.spyOn(WebAuthApi, 'refresh').mockResolvedValue(undefined);
	navigatorDescriptor = Object.getOwnPropertyDescriptor(
		globalThis,
		'navigator'
	);
});

afterEach(() => {
	refreshSpy.mockRestore();
	dateNowSpy?.mockRestore();
	dateNowSpy = undefined;
	// Restore the global first: a test that removes `navigator` entirely
	// would otherwise leave the teardown (and every later test) throwing
	// on a non-object.
	if (navigatorDescriptor) {
		Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
	} else {
		Reflect.deleteProperty(globalThis, 'navigator');
	}
	Reflect.deleteProperty(navigator, 'userAgent');
});

describe('useSsoAuthorize — URL params', () => {
	it('never leaves the loading stage without a client_id', () => {
		setUrl(query({ redirect_uri: REDIRECT_URI }));

		const { result, store } = renderAuthorize(ME);

		expect(store.get(paramsAtom)).toBeNull();
		expect(result.current.stage).toEqual({ kind: 'loading' });
		expect(routerPush).not.toHaveBeenCalled();
		expect(launchDeepLink).not.toHaveBeenCalled();
	});

	it('never leaves the loading stage without a redirect_uri', () => {
		setUrl(query({ client_id: 'app-1' }));

		const { result, store } = renderAuthorize(ME);

		expect(store.get(paramsAtom)).toBeNull();
		expect(result.current.stage).toEqual({ kind: 'loading' });
	});

	it('treats a whitespace-only client_id as missing', () => {
		setUrl(query({ client_id: '   ', redirect_uri: REDIRECT_URI }));

		const { store } = renderAuthorize(ME);

		expect(store.get(paramsAtom)).toBeNull();
		expect(routerPush).not.toHaveBeenCalled();
	});

	it('treats an empty redirect_uri as missing', () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: '' }));

		const { store } = renderAuthorize(ME);

		expect(store.get(paramsAtom)).toBeNull();
	});

	it('parses scope lists, state, PKCE and nonce into the shared params', () => {
		setUrl(
			query({
				client_id: 'app-1',
				redirect_uri: REDIRECT_URI,
				scope: 'openid profile,email',
				state: 'st-1',
				code_challenge: 'chal-1',
				code_challenge_method: 'S256',
				nonce: 'n-1',
			})
		);

		const { store } = renderAuthorize(ME);

		expect(store.get(paramsAtom)).toEqual({
			appId: 'app-1',
			scope: ['openid', 'profile', 'email'],
			state: 'st-1',
			redirectUri: REDIRECT_URI,
			codeChallenge: 'chal-1',
			codeChallengeMethod: 'S256',
			nonce: 'n-1',
		});
	});

	it('defaults the optional params to empty values instead of null', () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));

		const { store } = renderAuthorize(ME);

		expect(store.get(paramsAtom)).toStrictEqual({
			appId: 'app-1',
			scope: [],
			state: '',
			redirectUri: REDIRECT_URI,
			codeChallenge: undefined,
			codeChallengeMethod: undefined,
			nonce: undefined,
		});
	});
});

describe('useSsoAuthorize — desktop', () => {
	it('sends an anonymous visitor to /login and remembers the request URL', async () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));

		const { result } = renderAuthorize(null);

		await waitFor(() =>
			expect(routerPush).toHaveBeenCalledWith(
				`/login?from=${encodeURIComponent(
					`/sso-authorize${query({
						client_id: 'app-1',
						redirect_uri: REDIRECT_URI,
					})}`
				)}`
			)
		);
		expect(result.current.stage).toEqual({ kind: 'loading' });
		expect(launchDeepLink).not.toHaveBeenCalled();
	});

	it('goes straight to consent when the session is already known', async () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));

		const { result } = renderAuthorize(ME);

		await waitFor(() =>
			expect(result.current.stage).toEqual({ kind: 'consent', me: ME })
		);
		expect(launchDeepLink).not.toHaveBeenCalled();
		expect(routerPush).not.toHaveBeenCalled();
	});

	it('treats a missing navigator as a desktop browser', async () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));
		Object.defineProperty(globalThis, 'navigator', {
			value: undefined,
			configurable: true,
			writable: true,
		});

		const { result, store } = renderAuthorize(ME);

		await waitFor(() =>
			expect(result.current.stage).toEqual({ kind: 'consent', me: ME })
		);
		// Device detection never ran, so the shared atom keeps its default
		// instead of guessing a device kind from a UA that is not there.
		expect(store.get(paramsAtom)?.appId).toBe('app-1');
		expect(launchDeepLink).not.toHaveBeenCalled();
	});
});

describe('useSsoAuthorize — mobile deep-link handoff', () => {
	it('hands the parsed request to the app and stays on the trying screen', async () => {
		setUrl(
			query({
				client_id: 'app-1',
				redirect_uri: REDIRECT_URI,
				scope: 'openid profile',
				state: 'st-1',
			})
		);
		setUserAgent(IOS_UA);
		launchDeepLink.mockResolvedValue({ launched: true });

		const { result } = renderAuthorize(ME);

		await waitFor(() =>
			expect(result.current.stage).toEqual({ kind: 'deep-link-trying' })
		);
		expect(launchDeepLink).toHaveBeenCalledTimes(1);
		expect(launchDeepLink).toHaveBeenCalledWith({
			url:
				'ham://sso-authorize?client_id=app-1&scope=openid+profile&state=st-1' +
				'&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb',
			timeoutMs: 1500,
		});
	});

	it('falls back to in-browser consent when the app does not open', async () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));
		setUserAgent(IOS_UA);

		const { result } = renderAuthorize(ME);

		await waitFor(() =>
			expect(result.current.stage).toEqual({ kind: 'consent', me: ME })
		);
		expect(routerPush).not.toHaveBeenCalled();
	});

	it('offers the login fallback to an anonymous visitor on mobile', async () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));
		setUserAgent(IOS_UA);

		const { result } = renderAuthorize(null);

		await waitFor(() =>
			expect(result.current.stage).toEqual({
				kind: 'deep-link-fallback',
				authenticated: false,
			})
		);
		expect(routerPush).not.toHaveBeenCalled();
	});

	it('keeps waiting for an anonymous visitor while the app opens', async () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));
		setUserAgent(IOS_UA);
		launchDeepLink.mockResolvedValue({ launched: true });

		const { result } = renderAuthorize(null);

		await waitFor(() =>
			expect(result.current.stage).toEqual({ kind: 'deep-link-trying' })
		);
	});

	it('probes the app only once, even when the session changes', async () => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));
		setUserAgent(IOS_UA);

		const { result, rerender } = renderAuthorize(ME);
		await waitFor(() =>
			expect(result.current.stage).toEqual({ kind: 'consent', me: ME })
		);

		await act(async () => {
			rerender({ currentMe: OTHER_ME });
		});

		// A second launch would drag the user back into the app after they
		// already returned to the tab, so the probe must not re-fire.
		expect(launchDeepLink).toHaveBeenCalledTimes(1);
		expect(result.current.stage).toEqual({ kind: 'consent', me: ME });
	});
});

describe('useSsoAuthorize — session refresh on refocus', () => {
	const mountOnConsent = async (me: MeResponse | null = ME) => {
		setUrl(query({ client_id: 'app-1', redirect_uri: REDIRECT_URI }));
		setUserAgent(IOS_UA);
		const view = renderAuthorize(me);
		await waitFor(() => expect(launchDeepLink).toHaveBeenCalled());
		await waitFor(() =>
			expect(view.result.current.stage.kind).not.toBe('deep-link-trying')
		);
		return view;
	};

	const advanceClock = (offsetMs: number) => {
		// Relative to the real clock, not to a fixed epoch: the hook stamps
		// the session with the real `Date.now()` at mount, so an absolute
		// value in the past would read as "confirmed in the future" and the
		// session would never look stale.
		const base = Date.now();
		dateNowSpy = vi.spyOn(Date, 'now');
		dateNowSpy.mockReturnValue(base + offsetMs);
	};

	it('does not refresh while the tab is still hidden', async () => {
		await mountOnConsent();
		setHidden(true);
		advanceClock(10 * 60 * 1000);

		await focusTab();

		expect(refreshSpy).not.toHaveBeenCalled();
	});

	it('does not refresh a session confirmed moments ago', async () => {
		await mountOnConsent();
		advanceClock(60 * 1000);

		await focusTab();

		expect(refreshSpy).not.toHaveBeenCalled();
	});

	it('refreshes a stale session and re-stamps the confirmation clock', async () => {
		await mountOnConsent();
		advanceClock(10 * 60 * 1000);

		await focusTab();
		expect(refreshSpy).toHaveBeenCalledTimes(1);

		await focusTab();
		expect(refreshSpy).toHaveBeenCalledTimes(1);
	});

	it('sends the visitor back to /login when the refresh is unauthorized', async () => {
		await mountOnConsent();
		advanceClock(10 * 60 * 1000);
		refreshSpy.mockRejectedValue(new ApiError(401));

		await focusTab();

		await waitFor(() =>
			expect(routerPush).toHaveBeenCalledWith(
				expect.stringContaining('/login?from=')
			)
		);
	});

	it('ignores a refresh failure that is not a 401', async () => {
		await mountOnConsent();
		advanceClock(10 * 60 * 1000);
		refreshSpy.mockRejectedValue(new ApiError(500));

		await focusTab();

		expect(routerPush).not.toHaveBeenCalled();
	});

	it('ignores a refresh failure that is not an API error at all', async () => {
		await mountOnConsent();
		advanceClock(10 * 60 * 1000);
		refreshSpy.mockRejectedValue(new Error('network down'));

		await focusTab();

		expect(routerPush).not.toHaveBeenCalled();
	});

	it('does not refresh while the page is not showing consent', async () => {
		await mountOnConsent(null);
		advanceClock(10 * 60 * 1000);

		await focusTab();

		expect(refreshSpy).not.toHaveBeenCalled();
	});
});
