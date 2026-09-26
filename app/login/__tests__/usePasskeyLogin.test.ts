/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:19:22
 *
 * Unit tests for usePasskeyLogin — the WebAuthn path on the login page.
 *
 * Two things make this hook worth pinning down. First, the support probe has
 * to happen after mount: probing during render makes the server and the first
 * client render disagree, which is a hydration mismatch on every /login load.
 * Second, the failure handling is deliberately uneven — a user who cancels the
 * system prompt must not be told they failed, while a server rejection has to
 * show the backend's own message. These tests drive the real WebAuthn boundary
 * (`navigator.credentials.get`) and assert the toast, the loading flag and the
 * payload that actually reaches the BFF.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	toastError,
	translate,
	getPasskeyOption,
	passkeyLogin,
	credentialsGet,
} = vi.hoisted(() => ({
	toastError: vi.fn(),
	translate: (key: string) => key,
	getPasskeyOption: vi.fn(),
	passkeyLogin: vi.fn(),
	credentialsGet: vi.fn(),
}));

vi.mock('next-intl', () => ({
	useTranslations: () => translate,
}));

vi.mock('react-hot-toast', () => ({
	default: { error: (...args: unknown[]) => toastError(...args) },
}));

// Only the HTTP boundary is faked. `ApiError` has to stay the real class,
// because the hook dispatches on `e instanceof ApiError`.
vi.mock('@/services/sso/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/sso/api')>();
	return {
		...actual,
		WebAuthApi: { ...actual.WebAuthApi, getPasskeyOption, passkeyLogin },
	};
});

import { usePasskeyLogin } from '@/app/login/usePasskeyLogin';
import { ApiError } from '@/services/sso/api';

const OPTION_SESSION = 'session-1';

const optionWith = (publicKey: Record<string, unknown>) => ({
	session: OPTION_SESSION,
	json: JSON.stringify({ publicKey }),
});

// Base64URL for "challenge" and "cred" — the wire format the backend uses.
const CHALLENGE = 'Y2hhbGxlbmdl';
const CREDENTIAL_ID = 'Y3JlZA';

/**
 * Turns `window` into a browser that does or does not implement WebAuthn.
 * The hook probes exactly these two globals.
 */
const setPasskeySupport = (supported: boolean) => {
	Object.defineProperty(window, 'PublicKeyCredential', {
		value: supported ? class PublicKeyCredential {} : undefined,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(navigator, 'credentials', {
		value: supported ? { get: credentialsGet, create: vi.fn() } : undefined,
		configurable: true,
		writable: true,
	});
};

const createAssertion = () =>
	({
		id: 'credential-id',
		rawId: new Uint8Array([1, 2, 3]).buffer,
		type: 'public-key',
		response: {
			authenticatorData: new Uint8Array([4, 5]).buffer,
			clientDataJSON: new Uint8Array([6, 7]).buffer,
			signature: new Uint8Array([8, 9]).buffer,
			userHandle: new Uint8Array([10]).buffer,
		},
		getClientExtensionResults: () => ({}),
	}) as unknown as PublicKeyCredential;

const lastRequest = () =>
	credentialsGet.mock.calls.at(-1)?.[0] as CredentialRequestOptions;

describe('usePasskeyLogin', () => {
	beforeEach(() => {
		toastError.mockReset();
		getPasskeyOption.mockReset();
		passkeyLogin.mockReset();
		credentialsGet.mockReset();
		setPasskeySupport(true);
		getPasskeyOption.mockResolvedValue(
			optionWith({
				challenge: CHALLENGE,
				allowCredentials: [{ id: CREDENTIAL_ID, type: 'public-key' }],
				rpId: 'ham.example',
			})
		);
		credentialsGet.mockResolvedValue(createAssertion());
		passkeyLogin.mockResolvedValue({ user_id: 'u-1' });
	});

	it('probes WebAuthn support after mount and reports it missing', () => {
		setPasskeySupport(false);
		const { result } = renderHook(() => usePasskeyLogin());

		expect(result.current.supported).toBe(false);
	});

	it('reports WebAuthn support once the probe finds it', () => {
		const { result } = renderHook(() => usePasskeyLogin());

		expect(result.current.supported).toBe(true);
	});

	it('decodes the challenge and credential ids, then verifies the assertion', async () => {
		const onLoginSucceeded = vi.fn();
		const { result } = renderHook(() => usePasskeyLogin(onLoginSucceeded));

		expect(result.current.loading).toBe(false);
		let started: Promise<void> | undefined;
		act(() => {
			started = result.current.login();
		});
		expect(result.current.loading).toBe(true);

		await act(async () => {
			await started;
		});
		expect(result.current.loading).toBe(false);

		const request = lastRequest();
		expect(request.mediation).toBe('optional');
		expect(
			new TextDecoder().decode(request.publicKey?.challenge as ArrayBuffer)
		).toBe('challenge');
		expect(
			new TextDecoder().decode(
				request.publicKey?.allowCredentials?.[0]?.id as ArrayBuffer
			)
		).toBe('cred');

		expect(passkeyLogin).toHaveBeenCalledTimes(1);
		const [assertion, session] = passkeyLogin.mock.calls[0] as [string, string];
		expect(session).toBe(OPTION_SESSION);
		expect(JSON.parse(assertion)).toMatchObject({
			id: 'credential-id',
			type: 'public-key',
			rawId: expect.any(String),
		});
		expect(onLoginSucceeded).toHaveBeenCalledTimes(1);
	});

	it('leaves an already-decoded challenge and credential id untouched', async () => {
		const challenge = { already: 'decoded' };
		const rawId = { already: 'decoded' };
		getPasskeyOption.mockResolvedValue(
			optionWith({
				challenge,
				allowCredentials: [{ id: rawId, type: 'public-key' }],
			})
		);
		const { result } = renderHook(() => usePasskeyLogin());

		await act(async () => {
			await result.current.login();
		});

		// JSON.parse hands back fresh objects, so identity is not observable
		// — the point is that neither value came back as decoded bytes.
		const request = lastRequest();
		expect(request.publicKey?.challenge).toEqual({ already: 'decoded' });
		expect(request.publicKey?.challenge).not.toBeInstanceOf(ArrayBuffer);
		expect(request.publicKey?.allowCredentials?.[0]?.id).toEqual({
			already: 'decoded',
		});
		expect(request.publicKey?.allowCredentials?.[0]?.id).not.toBeInstanceOf(
			ArrayBuffer
		);
	});

	it('surfaces a toast when the user picks no credential', async () => {
		getPasskeyOption.mockResolvedValue(
			// Discoverable credentials: no allowCredentials at all.
			optionWith({ challenge: CHALLENGE })
		);
		credentialsGet.mockResolvedValue(null);
		const onLoginSucceeded = vi.fn();
		const { result } = renderHook(() => usePasskeyLogin(onLoginSucceeded));

		await act(async () => {
			await result.current.login();
		});

		expect(toastError).toHaveBeenCalledWith('noPick');
		expect(passkeyLogin).not.toHaveBeenCalled();
		expect(onLoginSucceeded).not.toHaveBeenCalled();
		expect(result.current.loading).toBe(false);
	});

	it('shows the backend message when the server rejects the login', async () => {
		getPasskeyOption.mockRejectedValue(
			new ApiError(401, { code: 'passkey_expired', message: 'Expired' })
		);
		const { result } = renderHook(() => usePasskeyLogin());

		await act(async () => {
			await result.current.login();
		});

		expect(toastError).toHaveBeenCalledWith('Expired');
		expect(result.current.loading).toBe(false);
	});

	it('falls back to the generic message for an ApiError without one', async () => {
		getPasskeyOption.mockRejectedValue(
			new ApiError(500, { code: 'internal', message: '' })
		);
		const { result } = renderHook(() => usePasskeyLogin());

		await act(async () => {
			await result.current.login();
		});

		expect(toastError).toHaveBeenCalledWith('loginFailed');
	});

	it('stays silent when the user cancels the system prompt', async () => {
		getPasskeyOption.mockRejectedValue(
			new DOMException('the user cancelled', 'NotAllowedError')
		);
		const { result } = renderHook(() => usePasskeyLogin());

		await act(async () => {
			await result.current.login();
		});

		expect(toastError).not.toHaveBeenCalled();
		expect(result.current.loading).toBe(false);
	});

	it('stays silent when the assertion request is aborted', async () => {
		credentialsGet.mockRejectedValue(
			new DOMException('the request was aborted', 'AbortError')
		);
		const { result } = renderHook(() => usePasskeyLogin());

		await act(async () => {
			await result.current.login();
		});

		expect(toastError).not.toHaveBeenCalled();
		expect(result.current.loading).toBe(false);
	});

	it('surfaces the generic failure toast for an unexpected error', async () => {
		passkeyLogin.mockRejectedValue(new Error('socket hang up'));
		const onLoginSucceeded = vi.fn();
		const { result } = renderHook(() => usePasskeyLogin(onLoginSucceeded));

		await act(async () => {
			await result.current.login();
		});

		expect(toastError).toHaveBeenCalledWith('loginFailed');
		expect(onLoginSucceeded).not.toHaveBeenCalled();
		expect(result.current.loading).toBe(false);
	});

	it('does not report success after the hook is unmounted', async () => {
		let release!: (value: unknown) => void;
		getPasskeyOption.mockImplementation(
			() => new Promise((r) => (release = r))
		);
		const onLoginSucceeded = vi.fn();
		const { result, unmount } = renderHook(() =>
			usePasskeyLogin(onLoginSucceeded)
		);

		let started: Promise<void> | undefined;
		act(() => {
			started = result.current.login();
		});
		unmount();

		release(optionWith({ challenge: CHALLENGE }));
		await act(async () => {
			await started;
		});

		expect(passkeyLogin).toHaveBeenCalledTimes(1);
		expect(onLoginSucceeded).not.toHaveBeenCalled();
		expect(toastError).not.toHaveBeenCalled();
	});
});
