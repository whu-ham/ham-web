/**
 * Custom hook for Passkey (WebAuthn) login flow.
 * Handles credential request and server verification.
 * On success, session cookie is set by backend — just call onLoginSucceeded.
 */

'use client';

import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
	base64ToArrayBuffer,
	credentialToJSON,
} from '@/app/login/passkey-utils';
import { ApiError, WebAuthApi } from '@/services/sso/api';
import { isPasskeySupported } from '@/services/sso/ua';

export interface UsePasskeyLoginReturn {
	loading: boolean;
	login: () => Promise<void>;
	supported: boolean | null;
}

export const usePasskeyLogin = (
	onLoginSucceeded?: () => void
): UsePasskeyLoginReturn => {
	const t = useTranslations('sso.passkey');
	const [loading, setLoading] = useState(false);
	const supported = useMemo<boolean | null>(() => {
		if (typeof window === 'undefined') return null;
		return isPasskeySupported();
	}, []);
	const cancelledRef = useRef(false);

	useEffect(() => {
		return () => {
			cancelledRef.current = true;
		};
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
			if (typeof (options.challenge as unknown) === 'string') {
				options.challenge = base64ToArrayBuffer(
					options.challenge as unknown as string
				);
			}
			if (Array.isArray(options.allowCredentials)) {
				options.allowCredentials = options.allowCredentials.map((c) => ({
					...c,
					id:
						typeof (c.id as unknown) === 'string'
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

			// Session cookie is already set by backend — just signal success
			if (!cancelledRef.current) {
				onLoginSucceeded?.();
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
			if (!cancelledRef.current) {
				setLoading(false);
			}
		}
	}, [onLoginSucceeded, t]);

	return { loading, login, supported };
};
