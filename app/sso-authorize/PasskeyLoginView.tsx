/**
 * @author Claude
 * @version 1.8
 * @date 2026/4/21 15:38:00
 *
 * Passkey login button (compact). Talks to the HTTP endpoints:
 *   POST /web/auth/passkey/option   — returns the WebAuthn request options
 *   POST /web/auth/passkey/login    — verifies the assertion + Set-Cookie
 *
 * Renders nothing when the browser does not support WebAuthn / Passkeys.
 */
'use client';

import { Button } from '@heroui/react';
import toast from 'react-hot-toast';
import { useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, WebAuthApi } from '@/services/sso/api';
import { isPasskeySupported } from '@/services/sso/ua';
import { stageAtom } from '@/app/sso-authorize/store';

const PasskeyLoginView = () => {
	const t = useTranslations('sso.passkey');
	const setStage = useSetAtom(stageAtom);
	const [loading, setLoading] = useState(false);
	const [supported, setSupported] = useState<boolean | null>(null);

	useEffect(() => {
		setSupported(isPasskeySupported());
	}, []);

	const login = useCallback(async () => {
		setLoading(true);
		try {
			const opt = await WebAuthApi.getPasskeyOption();
			const parsed = JSON.parse(opt.json) as {
				publicKey: PublicKeyCredentialRequestOptions;
			};
			const options =
				parsed.publicKey as unknown as PublicKeyCredentialRequestOptions;
			if (typeof options.challenge === 'string') {
				options.challenge = base64ToArrayBuffer(
					options.challenge as unknown as string
				);
			}
			if (Array.isArray(options.allowCredentials)) {
				options.allowCredentials = options.allowCredentials.map((c) => ({
					...c,
					id:
						typeof c.id === 'string'
							? base64ToArrayBuffer(c.id as unknown as string)
							: c.id,
				}));
			}

			const credential = (await navigator.credentials.get({
				publicKey: options,
				mediation: 'optional',
			})) as PublicKeyCredential | null;
			if (!credential) {
				toast.error(t('noPick'));
				return;
			}

			const assertionJSON = JSON.stringify(credentialToJSON(credential));
			await WebAuthApi.passkeyLogin(assertionJSON, opt.session);

			try {
				const me = await WebAuthApi.me();
				setStage({ kind: 'consent', me });
			} catch {
				setStage({ kind: 'login' });
			}
		} catch (e) {
			if (e instanceof ApiError) {
				toast.error(e.message || t('loginFailed'));
			} else if (
				e instanceof DOMException &&
				(e.name === 'NotAllowedError' || e.name === 'AbortError')
			) {
				// User cancelled — silent fail.
			} else {
				toast.error(t('loginFailed'));
			}
		} finally {
			setLoading(false);
		}
	}, [setStage, t]);

	// Render nothing until support is confirmed (avoids SSR flash and hides on unsupported browsers)
	if (!supported) return null;

	return (
		<Button variant={'tertiary'} isPending={loading} onPress={login}>
			<span
				className={'material-icons-round !text-[18px] !leading-none'}
				aria-hidden={true}
			>
				key
			</span>
			{t('cta')}
		</Button>
	);
};

function base64ToArrayBuffer(value: string): ArrayBuffer {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(
		normalized.length + ((4 - (normalized.length % 4)) % 4),
		'='
	);
	const raw = atob(padded);
	const buf = new ArrayBuffer(raw.length);
	const view = new Uint8Array(buf);
	for (let i = 0; i < raw.length; i++) {
		view[i] = raw.charCodeAt(i);
	}
	return buf;
}

function arrayBufferToBase64URL(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function credentialToJSON(credential: PublicKeyCredential) {
	const response = credential.response as AuthenticatorAssertionResponse;
	return {
		id: credential.id,
		rawId: arrayBufferToBase64URL(credential.rawId),
		type: credential.type,
		response: {
			authenticatorData: arrayBufferToBase64URL(response.authenticatorData),
			clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
			signature: arrayBufferToBase64URL(response.signature),
			userHandle: response.userHandle
				? arrayBufferToBase64URL(response.userHandle)
				: null,
		},
		clientExtensionResults: credential.getClientExtensionResults(),
	};
}

export default PasskeyLoginView;
