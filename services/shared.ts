/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * Shared HTTP client infrastructure extracted from services/sso/api.ts.
 * Provides ApiError, request<T>(), and API_BASE for reuse across
 * sso/api.ts, token/api.ts, and future service modules.
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
export const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE ?? ''}/api`;

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
const getAcceptLanguage = (): string | undefined => {
	if (typeof document === 'undefined') return undefined;
	const raw = document.cookie
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith('NEXT_LOCALE='));
	if (!raw) return undefined;
	return decodeURIComponent(raw.slice('NEXT_LOCALE='.length)) || undefined;
};

export const request = async <T>(
	path: string,
	init?: RequestInit
): Promise<T> => {
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
};
