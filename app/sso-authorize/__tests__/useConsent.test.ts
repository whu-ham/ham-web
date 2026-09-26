/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:45:00
 *
 * Unit tests for useConsent — the logic behind the SSO consent screen.
 *
 * The screen decides what a third-party app is granted, so the tests pin
 * the selection rules rather than the rendering:
 *
 *   - an untouched selection means "everything the app asked for", but an
 *     explicitly emptied selection is a real answer and must stay empty
 *     (granting the scopes back is the bug this file guards);
 *   - required scopes are re-added on confirm even when the user cleared
 *     the matching checkbox, because the app cannot work without them;
 *   - denying or failing a request has to return the user to the app with
 *     an OAuth error code, and a redirect_uri we cannot parse must degrade
 *     into an on-screen message instead of stranding them.
 *
 * Boundaries are mocked (router, BFF calls, toasts, the redirect target);
 * the selection maths, the request payload and the error handling all run
 * for real behind the hook's public API.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	paramsAtom,
	stageAtom,
	type SsoAuthorizeParams,
	type Stage,
} from '@/app/sso-authorize/store';
import { useConsent } from '@/app/sso-authorize/useConsent';
import {
	ApiError,
	type ConsentInfoResponse,
	WebAuthApi,
} from '@/services/sso/api';

// The real router is a stable object and the hook memoises callbacks on it;
// a fresh object per render would re-run its effects on every render.
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
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
const { replaceLocation } = vi.hoisted(() => ({ replaceLocation: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('react-hot-toast', () => ({
	default: { error: (...args: unknown[]) => toastError(...args) },
}));

const PARAMS: SsoAuthorizeParams = {
	appId: 'app-1',
	scope: ['openid', 'mcp:read'],
	state: 'st-1',
	redirectUri: 'https://app.example.com/cb',
};

const ME = { user_id: 'u-1', nickname: 'Ada' };

const INFO: ConsentInfoResponse = {
	app: { client_id: 'app-1', name: 'Example App' },
	scopes: [
		{
			scope: 'openid',
			description: 'identity',
			already_granted: false,
			required: true,
		},
		{
			scope: 'mcp:read',
			description: 'read',
			already_granted: false,
			required: false,
		},
		{
			scope: 'mcp:write',
			description: 'write',
			already_granted: false,
			required: false,
		},
	],
	can_auto_authorize: false,
	nonce: 'n-1',
};

let locationDescriptor: PropertyDescriptor | undefined;

const renderConsent = (
	overrides: Partial<SsoAuthorizeParams> = {},
	stage?: Stage
) => {
	const store = createStore();
	store.set(paramsAtom, { ...PARAMS, ...overrides });
	store.set(stageAtom, stage ?? { kind: 'consent', me: ME });

	const Wrapper = ({ children }: { children: ReactNode }) =>
		createElement(Provider, { store }, children);

	return renderHook(() => useConsent(), { wrapper: Wrapper });
};

let infoSpy: ReturnType<typeof vi.spyOn>;
let confirmSpy: ReturnType<typeof vi.spyOn>;
let logoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	routerPush.mockReset();
	toastError.mockReset();
	replaceLocation.mockReset();

	// jsdom refuses to navigate, so the redirect target is swapped for a
	// spy — the hook only needs `location` to read the current path and to
	// hand the target off to the browser.
	locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
	Object.defineProperty(window, 'location', {
		value: {
			pathname: '/sso-authorize',
			search: '?client_id=app-1',
			href: 'https://ham.example.com/sso-authorize?client_id=app-1',
			replace: replaceLocation,
		},
		configurable: true,
		writable: true,
	});

	infoSpy = vi.spyOn(WebAuthApi, 'consentInfo').mockResolvedValue(INFO);
	confirmSpy = vi
		.spyOn(WebAuthApi, 'consentConfirm')
		.mockResolvedValue({ redirect_url: 'https://app.example.com/cb?code=c1' });
	logoutSpy = vi.spyOn(WebAuthApi, 'logout').mockResolvedValue(undefined);
});

afterEach(() => {
	infoSpy.mockRestore();
	confirmSpy.mockRestore();
	logoutSpy.mockRestore();
	if (locationDescriptor) {
		Object.defineProperty(window, 'location', locationDescriptor);
	}
});

describe('useConsent — consent info', () => {
	it('asks the BFF for the consent info and exposes it', async () => {
		const { result } = renderConsent();

		expect(infoSpy).toHaveBeenCalledWith({
			client_id: 'app-1',
			scope: ['openid', 'mcp:read'],
			redirect_uri: 'https://app.example.com/cb',
			state: 'st-1',
		});

		await waitFor(() => expect(result.current.info).toEqual(INFO));
		expect(result.current.error).toBeNull();
	});

	it('forwards the PKCE challenge and nonce only when they were requested', async () => {
		renderConsent({ codeChallenge: 'chal-1', codeChallengeMethod: 'S256' });

		expect(infoSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				code_challenge: 'chal-1',
				code_challenge_method: 'S256',
			})
		);
		expect(infoSpy.mock.calls[0][0]).not.toHaveProperty('nonce');
	});

	it('forwards the nonce when the app sent one', () => {
		renderConsent({ nonce: 'n-9' });

		expect(infoSpy).toHaveBeenCalledWith(
			expect.objectContaining({ nonce: 'n-9' })
		);
	});

	it('surfaces a failure instead of an empty consent screen', async () => {
		infoSpy.mockRejectedValue(new ApiError(500));

		const { result } = renderConsent();

		await waitFor(() => expect(result.current.error).toBe('fetchFailed'));
		expect(result.current.info).toBeNull();
	});

	it('ignores a reply that lands after unmount', async () => {
		let resolveInfo: (value: ConsentInfoResponse) => void = () => undefined;
		infoSpy.mockImplementation(
			() =>
				new Promise<ConsentInfoResponse>((resolve) => {
					resolveInfo = resolve;
				})
		);

		const { result, unmount } = renderConsent();
		unmount();

		await act(async () => {
			resolveInfo(INFO);
			await Promise.resolve();
		});

		// The component is gone; a late setState would warn and, worse,
		// resurrect a screen the user already navigated away from.
		expect(result.current.info).toBeNull();
	});

	it('stays quiet when the failure lands after unmount', async () => {
		infoSpy.mockImplementation(
			() => new Promise((_resolve, reject) => setTimeout(reject, 0))
		);

		const { result, unmount } = renderConsent();
		unmount();

		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(result.current.error).toBeNull();
	});
});

describe('useConsent — scope selection', () => {
	it('treats an untouched selection as every requested scope', async () => {
		const { result } = renderConsent();

		await waitFor(() =>
			expect(result.current.checkedScopes).toEqual([
				'openid',
				'mcp:read',
				'mcp:write',
			])
		);
	});

	it('reports an empty selection before the info arrives', () => {
		infoSpy.mockImplementation(() => new Promise(() => undefined));

		const { result } = renderConsent();

		expect(result.current.checkedScopes).toEqual([]);
	});

	it('keeps a deliberately emptied selection empty', async () => {
		const { result } = renderConsent();
		await waitFor(() => expect(result.current.info).toEqual(INFO));

		act(() => {
			result.current.setCheckedScopes([]);
		});

		// Deselecting everything is a real answer — falling back to the
		// requested scopes would grant what the user just removed.
		expect(result.current.checkedScopes).toEqual([]);
	});

	it('reports exactly what the user selected', async () => {
		const { result } = renderConsent();
		await waitFor(() => expect(result.current.info).toEqual(INFO));

		act(() => {
			result.current.setCheckedScopes(['mcp:read']);
		});

		expect(result.current.checkedScopes).toEqual(['mcp:read']);
	});
});

describe('useConsent — confirm', () => {
	const confirm = async (nonce = 'n-1') => {
		const view = renderConsent();
		await waitFor(() => expect(view.result.current.info).toEqual(INFO));
		await act(async () => {
			await view.result.current.confirm(nonce);
		});
		return view;
	};

	it('submits an in-flight selection untouched when the info has not landed', async () => {
		infoSpy.mockImplementation(() => new Promise(() => undefined));

		const { result } = renderConsent();
		act(() => {
			result.current.setCheckedScopes(['mcp:read']);
		});

		await act(async () => {
			await result.current.confirm('n-1');
		});

		// Without the info there is no required-scope list to reconcile
		// against, so the selection is submitted as the user left it.
		expect(confirmSpy.mock.lastCall?.[0].scope).toEqual(['mcp:read']);
	});

	it('submits the selection with the request identifiers', async () => {
		await confirm();

		expect(confirmSpy).toHaveBeenCalledWith({
			client_id: 'app-1',
			scope: ['openid', 'mcp:read', 'mcp:write'],
			redirect_uri: 'https://app.example.com/cb',
			state: 'st-1',
			nonce: 'n-1',
		});
	});

	it('re-adds a required scope the user cleared', async () => {
		await confirm();

		const view = renderConsent();
		await waitFor(() => expect(view.result.current.info).toEqual(INFO));
		act(() => {
			view.result.current.setCheckedScopes(['mcp:read']);
		});

		await act(async () => {
			await view.result.current.confirm('n-1');
		});

		expect(confirmSpy.mock.lastCall?.[0].scope).toContain('openid');
	});

	it('sends the user to the redirect url the backend returns', async () => {
		await confirm();

		expect(replaceLocation).toHaveBeenCalledWith(
			'https://app.example.com/cb?code=c1'
		);
	});

	it('clears the submitting flag after a successful confirm', async () => {
		const view = await confirm();

		expect(view.result.current.submitting).toBe(false);
	});

	it('reports the backend message and hands the error back to the app', async () => {
		confirmSpy.mockRejectedValue(
			new ApiError(400, { code: '12002', message: 'scope not allowed' })
		);

		await confirm();

		expect(toastError).toHaveBeenCalledWith('scope not allowed');
		// The user still has to land back on the app with an OAuth error,
		// otherwise the flow hangs on a dead consent screen.
		expect(replaceLocation).toHaveBeenCalledWith(
			expect.stringContaining('error=server_error')
		);
	});

	it('falls back to a generic message when the backend sends none', async () => {
		// `new ApiError(status)` stringifies the status as the code, so the
		// message the toast shows is the fallback translation.
		confirmSpy.mockRejectedValue(new ApiError(500, { code: '0', message: '' }));

		await confirm();

		expect(toastError).toHaveBeenCalledWith('submitFailed');
	});

	it('treats a non-API failure as a server error too', async () => {
		confirmSpy.mockRejectedValue(new Error('network down'));

		await confirm();

		expect(toastError).toHaveBeenCalledWith('submitFailed');
		expect(replaceLocation).toHaveBeenCalledWith(
			expect.stringContaining('error=server_error')
		);
	});
});

describe('useConsent — denying the request', () => {
	it('returns an access_denied error with the state to the app', () => {
		const { result } = renderConsent();

		act(() => {
			result.current.bail('access_denied');
		});

		expect(replaceLocation).toHaveBeenCalledWith(
			'https://app.example.com/cb?error=access_denied&state=st-1'
		);
	});

	it('omits the state when the app did not send one', () => {
		const { result } = renderConsent({ state: '' });

		act(() => {
			result.current.bail('server_error');
		});

		expect(replaceLocation).toHaveBeenCalledWith(
			'https://app.example.com/cb?error=server_error'
		);
	});

	it('shows the denial on screen when the redirect_uri is unusable', () => {
		const { result } = renderConsent({ redirectUri: 'not-a-url' });

		act(() => {
			result.current.bail('access_denied');
		});

		expect(result.current.error).toBe('accessDenied');
		expect(replaceLocation).not.toHaveBeenCalled();
	});

	it('distinguishes a server error from a denial', () => {
		const { result } = renderConsent({ redirectUri: 'not-a-url' });

		act(() => {
			result.current.bail('server_error');
		});

		expect(result.current.error).toBe('serverError');
	});
});

describe('useConsent — switching account', () => {
	it('logs out and sends the user back to login with the request URL', async () => {
		const { result } = renderConsent();

		await act(async () => {
			await result.current.onSwitchAccount();
		});

		expect(logoutSpy).toHaveBeenCalled();
		expect(routerPush).toHaveBeenCalledWith(
			`/login?from=${encodeURIComponent('/sso-authorize?client_id=app-1')}`
		);
	});

	it('still leaves for login when the logout call fails', async () => {
		logoutSpy.mockRejectedValue(
			new ApiError(500, { code: '1', message: 'down' })
		);
		const { result } = renderConsent();

		// The hook navigates from a `finally` and lets the rejection through:
		// the caller is a press handler, so nothing would catch it here.
		await act(async () => {
			await result.current.onSwitchAccount().catch(() => undefined);
		});

		expect(routerPush).toHaveBeenCalledWith(
			expect.stringContaining('/login?from=')
		);
	});

	it('exposes the signed-in user on the consent stage', () => {
		const { result } = renderConsent();

		expect(result.current.me).toEqual(ME);
	});

	it('reports no user before the screen reaches the consent stage', () => {
		const { result } = renderConsent({}, { kind: 'loading' });

		expect(result.current.me).toBeNull();
	});
});
