/**
 * @author Claude
 * @version 2.0
 * @date 2026/4/23 17:07:58
 *
 * HTTP client for the BFF /api/web/** endpoints.
 * All requests are sent to the Next.js BFF layer (same origin), which
 * proxies them server-side to the backend. This keeps backend credentials
 * and the backend origin out of the browser entirely.
 * Response bodies are normalized to match the Go handler JSON shapes
 * documented in internal/delivery/http/handler/web/*.go.
 */
'use client';

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
	// All requests go to the BFF (same origin) — no absolute backend URL needed.
	const res = await fetch(`/api${path}`, {
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
		request<CreateTicketResponse>('/web/auth/qr/ticket', { method: 'POST' }),
	checkQrTicket: (ticket: string) =>
		request<CheckTicketResponse>(
			`/web/auth/qr/ticket/${encodeURIComponent(ticket)}`
		),
	// Passkey ----------------------------------------------------------
	getPasskeyOption: () =>
		request<PasskeyOptionResponse>('/web/auth/passkey/option', {
			method: 'POST',
		}),
	passkeyLogin: (assertionJSON: string, session: string) =>
		request<PasskeyLoginResponse>('/web/auth/passkey/login', {
			method: 'POST',
			body: JSON.stringify({ assertion_json: assertionJSON, session }),
		}),
	// Session ----------------------------------------------------------
	me: () => request<MeResponse>('/web/auth/me'),
	logout: () => request<void>('/web/auth/logout', { method: 'POST' }),
	refresh: () => request<void>('/web/auth/refresh', { method: 'POST' }),
	// Consent ----------------------------------------------------------
	consentInfo: (payload: {
		client_id: string;
		scope: string[];
		redirect_uri: string;
		state: string;
	}) =>
		request<ConsentInfoResponse>('/web/sso/consent/info', {
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
		request<ConsentConfirmResponse>('/web/sso/consent/confirm', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
};
