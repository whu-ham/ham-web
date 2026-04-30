/**
 * @author Claude
 * @version 2.2
 * @date 2026/4/30 15:16:00
 *
 * HTTP client for the BFF /api/** endpoints.
 *
 * By default requests are sent to the same origin under `/api`, which is the
 * Next.js BFF layer that proxies them server-side to the backend. When the
 * frontend and BFF are deployed to separate origins (e.g. pages on
 * Cloudflare Workers, BFF on EdgeOne), set `NEXT_PUBLIC_API_BASE` at build
 * time to the absolute BFF origin (e.g. `https://api.example.com`) — the
 * value is inlined into the client bundle at build time and used as the
 * prefix for every request here.
 *
 * Response bodies are normalized to match the Go handler JSON shapes
 * documented in internal/delivery/http/handler/web/*.go.
 */
'use client';

/**
 * Absolute or relative base URL for BFF requests. When
 * `NEXT_PUBLIC_API_BASE` is empty / unset at build time we fall back to
 * same-origin `/api` so local development and single-origin deployments
 * keep working without any env configuration.
 *
 * NOTE: `NEXT_PUBLIC_*` values are inlined into the client bundle and are
 * therefore always visible to end users — never put real secrets here.
 */
const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE ?? ''}/api`;

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
	description: string;
	already_granted: boolean;
	/**
	 * Required scopes (e.g. "openid") are mandatory — the frontend must render
	 * them as checked + disabled so the user cannot uncheck them. The backend
	 * always injects the required set at the head of the list, even when the
	 * client did not request them, so this flag is authoritative.
	 */
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

// Backend error envelope. Code / message follow the shared errorx contract.
export interface ApiErrorBody {
	code: string;
	message?: string;
}

export class ApiError extends Error {
	public readonly status: number;
	public readonly code: string;
	constructor(status: number, body?: ApiErrorBody) {
		super(body?.message ?? `request failed: ${status}`);
		this.status = status;
		this.code = body?.code ?? String(status);
	}
}

/**
 * Read the active locale from the NEXT_LOCALE cookie so that every
 * backend request carries the correct Accept-Language header and the
 * server returns i18n content in the language the user has selected.
 * Falls back to the browser's own Accept-Language when no explicit
 * override cookie is present.
 */
function getAcceptLanguage(): string | undefined {
	if (typeof document === 'undefined') return undefined;
	const raw = document.cookie
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith('NEXT_LOCALE='));
	if (!raw) return undefined;
	return decodeURIComponent(raw.slice('NEXT_LOCALE='.length)) || undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const acceptLanguage = getAcceptLanguage();
	// All requests go to the BFF. `API_BASE` is either same-origin `/api`
	// (default) or `<NEXT_PUBLIC_API_BASE>/api` when the BFF lives on a
	// different origin. See the module header for details.
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		credentials: 'include',
		headers: {
			...(init?.body ? { 'Content-Type': 'application/json' } : {}),
			...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}),
			...(init?.headers ?? {}),
		},
	});
	if (!res.ok) {
		let body: ApiErrorBody | undefined;
		try {
			body = (await res.json()) as ApiErrorBody;
		} catch {
			body = undefined;
		}
		throw new ApiError(res.status, body);
	}
	if (res.status === 204) {
		return undefined as unknown as T;
	}
	return (await res.json()) as T;
}

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
	// Consent ----------------------------------------------------------
	consentInfo: (payload: {
		client_id: string;
		scope: string[];
		redirect_uri: string;
		state: string;
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
