/**
 * @author Claude
 * @version 2.4
 * @date 2026/5/26 10:42:28
 *
 * HTTP client for the BFF /api/auth/** endpoints (SSO & session).
 *
 * Shared HTTP infrastructure (ApiError, request<T>, API_BASE) has been
 * extracted to services/shared.ts. This module re-exports ApiError and
 * ApiErrorBody for backward compatibility with existing consumers.
 */
'use client';

// Re-export shared HTTP infrastructure for backward compatibility
export { ApiError, type ApiErrorBody } from '@/services/shared';

export const QR_TICKET_STATE = {
	PENDING: 'PENDING',
	SCANNED: 'SCANNED',
	CONFIRMED: 'CONFIRMED',
	EXPIRED: 'EXPIRED',
	INVALID: 'INVALID',
} as const;

export type QRTicketState =
	(typeof QR_TICKET_STATE)[keyof typeof QR_TICKET_STATE];

export interface CreateTicketResponse {
	ticket: string;
	expires_in: number;
}

export interface CheckTicketResponse {
	state: QRTicketState;
	expires_in?: number;
	scan_user_info?: {
		nickname?: string;
		avatar_url?: string;
	};
	user_info?: {
		user_id: string;
		nickname?: string;
		avatar_url?: string;
	};
}

export interface PasskeyOptionResponse {
	session: string;
	json: string;
}

export interface PasskeyLoginResponse {
	user_id: string;
	nickname?: string;
	avatar_url?: string;
}

export interface MeResponse {
	user_id: string;
	nickname?: string;
	avatar_url?: string;
}

export interface ConsentScopeDetail {
	scope: string;
	label?: string;
	description: string;
	category?: 'identity' | 'profile' | 'mcp' | string;
	already_granted: boolean;
	required: boolean;
}

export interface ConsentInfoResponse {
	app: {
		client_id: string;
		name: string;
		icon_url?: string;
		description?: string;
	};
	scopes: ConsentScopeDetail[];
	can_auto_authorize: boolean;
	nonce: string;
}

export interface ConsentConfirmResponse {
	redirect_url: string;
}

import { request } from '@/services/shared';

export const WebAuthApi = {
	// QR login ---------------------------------------------------------
	createQrTicket: () =>
		request<CreateTicketResponse>('/auth/qr/ticket', { method: 'POST' }),
	checkQrTicket: (ticket: string) =>
		request<CheckTicketResponse>(
			`/auth/qr/ticket/${encodeURIComponent(ticket)}`
		),
	// Passkey ----------------------------------------------------------
	getPasskeyOption: () =>
		request<PasskeyOptionResponse>('/auth/passkey/option', {
			method: 'POST',
		}),
	passkeyLogin: (assertionJSON: string, session: string) =>
		request<PasskeyLoginResponse>('/auth/passkey/login', {
			method: 'POST',
			body: JSON.stringify({ assertion_json: assertionJSON, session }),
		}),
	// Session ----------------------------------------------------------
	me: () => request<MeResponse>('/auth/me'),
	logout: () => request<void>('/auth/logout', { method: 'POST' }),
	refresh: () => request<void>('/auth/refresh', { method: 'POST' }),
	// App callback -----------------------------------------------------
	// m2: Removed — app callback is now handled server-side only via processAppCallback.
	// Consent ----------------------------------------------------------
	consentInfo: (payload: {
		client_id: string;
		scope: string[];
		redirect_uri: string;
		state: string;
		code_challenge?: string;
		code_challenge_method?: string;
		nonce?: string;
	}) =>
		request<ConsentInfoResponse>('/sso/consent/info', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	consentConfirm: (payload: {
		client_id: string;
		scope: string[];
		redirect_uri: string;
		state: string;
		nonce: string;
	}) =>
		request<ConsentConfirmResponse>('/sso/consent/confirm', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
};
