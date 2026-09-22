/**
 * @author Claude
 * @version 1.2
 * @date 2026/9/23 00:29:36
 *
 * Custom hook for SSO consent view logic.
 * Handles consent info fetching, scope selection, confirm/reject/switch account.
 *
 * `checkedScopes` now reports the scopes that will actually be
 * submitted. It used to report the raw selection, which is empty until
 * the user touches a checkbox — so the screen showed nothing selected
 * while a confirm sent every scope.
 */

'use client';

import { useAtomValue } from 'jotai';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { loginUrlWithFrom } from '@/services/redirect';
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
	const router = useRouter();
	const params = useAtomValue(paramsAtom)!;
	const stage = useAtomValue(stageAtom);
	const me = stage.kind === 'consent' ? stage.me : null;
	const t = useTranslations('sso.consent');
	const [info, setInfo] = useState<ConsentInfoResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	// Empty until the user touches a checkbox; until then every scope the
	// app asked for is the effective selection.
	const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
	const checkedScopes = useMemo(
		() =>
			selectedScopes.length > 0
				? selectedScopes
				: (info?.scopes.map((scope) => scope.scope) ?? []),
		[selectedScopes, info]
	);

	const onSwitchAccount = useCallback(async () => {
		try {
			await WebAuthApi.logout();
		} finally {
			// Router navigation keeps this an in-app transition; a
			// location.href assignment would reload the document.
			const from = window.location.pathname + window.location.search;
			router.push(loginUrlWithFrom(from));
		}
	}, [router]);

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
						? withRequiredConsentScopes(checkedScopes, info.scopes)
						: checkedScopes,
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
			checkedScopes,
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
			.catch(() => {
				if (cancelled) return;
				// The backend message is not user-safe and the screen offers
				// no recovery beyond retrying, so both branches say the same.
				setError(t('fetchFailed'));
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
		setCheckedScopes: setSelectedScopes,
		onSwitchAccount,
		bail,
		confirm,
	};
};
