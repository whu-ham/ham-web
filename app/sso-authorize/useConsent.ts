/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/26 10:42:28
 *
 * Custom hook for SSO consent view logic.
 * Handles consent info fetching, scope selection, confirm/reject/switch account.
 */

'use client';

import { useAtomValue } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { ApiError, ConsentInfoResponse, WebAuthApi } from '@/services/sso/api';
import { withRequiredConsentScopes } from '@/app/sso-authorize/consentScopes';
import { paramsAtom, stageAtom } from '@/app/sso-authorize/store';

export interface UseConsentReturn {
	me: { user_id: string; nickname?: string; avatar_url?: string } | null;
	info: ConsentInfoResponse | null;
	error: string | null;
	submitting: boolean;
	checkedScopes: string[];
	setCheckedScopes: (scopes: string[]) => void;
	onSwitchAccount: () => Promise<void>;
	bail: (oauthError: 'access_denied' | 'server_error') => void;
	confirm: (nonce: string) => Promise<void>;
}

export const useConsent = (): UseConsentReturn => {
	const params = useAtomValue(paramsAtom)!;
	const stage = useAtomValue(stageAtom);
	const me = stage.kind === 'consent' ? stage.me : null;
	const t = useTranslations('sso.consent');
	const [info, setInfo] = useState<ConsentInfoResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [checkedScopes, setCheckedScopes] = useState<string[]>([]);
	const effectiveCheckedScopes = useMemo(
		() =>
			checkedScopes.length > 0
				? checkedScopes
				: (info?.scopes.map((scope) => scope.scope) ?? []),
		[checkedScopes, info]
	);

	const onSwitchAccount = useCallback(async () => {
		try {
			await WebAuthApi.logout();
		} finally {
			const from = encodeURIComponent(
				window.location.pathname + window.location.search
			);
			window.location.href = `/login?from=${from}`;
		}
	}, []);

	const bail = useCallback(
		(oauthError: 'access_denied' | 'server_error') => {
			try {
				const url = new URL(params.redirectUri);
				url.searchParams.set('error', oauthError);
				if (params.state) {
					url.searchParams.set('state', params.state);
				}
				window.location.replace(url.toString());
			} catch {
				setError(
					oauthError === 'server_error' ? t('serverError') : t('accessDenied')
				);
			}
		},
		[params.redirectUri, params.state, t]
	);

	const confirm = useCallback(
		async (nonce: string) => {
			setSubmitting(true);
			try {
				const resp = await WebAuthApi.consentConfirm({
					client_id: params.appId,
					scope: info
						? withRequiredConsentScopes(effectiveCheckedScopes, info.scopes)
						: effectiveCheckedScopes,
					redirect_uri: params.redirectUri,
					state: params.state,
					nonce,
				});
				window.location.replace(resp.redirect_url);
			} catch (e) {
				if (e instanceof ApiError) {
					toast.error(e.message || t('submitFailed'));
				} else {
					toast.error(t('submitFailed'));
				}
				bail('server_error');
			} finally {
				setSubmitting(false);
			}
		},
		[
			bail,
			effectiveCheckedScopes,
			info,
			params.appId,
			params.redirectUri,
			params.state,
			t,
		]
	);

	useEffect(() => {
		let cancelled = false;
		WebAuthApi.consentInfo({
			client_id: params.appId,
			scope: params.scope,
			redirect_uri: params.redirectUri,
			state: params.state,
			...(params.codeChallenge && { code_challenge: params.codeChallenge }),
			...(params.codeChallengeMethod && {
				code_challenge_method: params.codeChallengeMethod,
			}),
			...(params.nonce && { nonce: params.nonce }),
		})
			.then((resp) => {
				if (cancelled) return;
				setInfo(resp);
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				if (e instanceof ApiError) {
					setError(t('fetchFailed'));
				} else {
					setError(t('fetchFailed'));
				}
			});
		return () => {
			cancelled = true;
		};
	}, [
		params.appId,
		params.codeChallenge,
		params.codeChallengeMethod,
		params.nonce,
		params.redirectUri,
		params.scope,
		params.state,
		t,
	]);

	return {
		me,
		info,
		error,
		submitting,
		checkedScopes,
		setCheckedScopes,
		onSwitchAccount,
		bail,
		confirm,
	};
};
