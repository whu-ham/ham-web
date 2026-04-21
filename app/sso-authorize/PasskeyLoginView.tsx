/**
 * @author Claude
 * @version 1.3
 * @date 2026/4/21 12:43:48
 *
 * Passkey login view. Talks to the new HTTP endpoints:
 *   POST /web/auth/passkey/option   — returns the WebAuthn request options
 *   POST /web/auth/passkey/login    — verifies the assertion + Set-Cookie
 *
 * The backend assertion format expects the raw JSON returned by
 * `navigator.credentials.get(...)` serialized back with Base64URL IDs, which
 * the browser already produces when we stringify the PublicKeyCredential
 * via the toJSON helper exposed by level-3 WebAuthn.
 */
'use client';

import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { ApiError, WebAuthApi } from '@/services/sso/api';
import { isPasskeySupported } from '@/services/sso/ua';

interface PasskeyLoginViewProps {
	onLoggedIn: () => void;
	/**
	 * When true, the view renders as a slim CTA suitable for stacking
	 * below the QR code (no large emoji / description / hint). Used by
	 * `LoginView` on desktop where QR is the primary option and Passkey
	 * is the secondary "or" option.
	 */
	compact?: boolean;
}

const PasskeyLoginView = ({
	onLoggedIn,
	compact = false,
}: PasskeyLoginViewProps) => {
	const t = useTranslations('sso.passkey');
	const [loading, setLoading] = useState(false);
	const [supported, setSupported] = useState(true);

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
			// The backend ships `challenge` as a base64 string; convert to
			// the ArrayBuffer the browser expects.
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
			onLoggedIn();
		} catch (e) {
			if (e instanceof ApiError) {
				toast.error(e.message || t('loginFailed'));
			} else if (
				e instanceof DOMException &&
				(e.name === 'NotAllowedError' || e.name === 'AbortError')
			) {
				// User cancelled the native prompt — silent fail is fine.
			} else {
				toast.error(t('loginFailed'));
			}
		} finally {
			setLoading(false);
		}
	}, [onLoggedIn, t]);

	if (compact) {
		return (
			<div className={'flex flex-col items-center gap-2'}>
				<Button
					variant={'tertiary'}
					isDisabled={!supported}
					isPending={loading}
					onPress={login}
				>
					<span
						className={'material-icons-round !text-[18px] !leading-none'}
						aria-hidden={true}
					>
						key
					</span>
					{t('cta')}
				</Button>
				{!supported && (
					<div className={'text-xs text-danger text-center max-w-sm'}>
						{t('unsupported')}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className={'flex flex-col items-center gap-4 py-6'}>
			<div className={'text-5xl'}>🔑</div>
			<div className={'text-sm text-muted text-center max-w-sm'}>
				{t('description')}
			</div>
			<Button
				variant={'tertiary'}
				isDisabled={!supported}
				isPending={loading}
				onPress={login}
			>
				{t('cta')}
			</Button>
			{!supported && (
				<div className={'text-xs text-danger text-center max-w-sm'}>
					{t('unsupported')}
				</div>
			)}
			<div className={'text-xs text-muted text-center max-w-sm'}>
				{t('hint')}
			</div>
		</div>
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
