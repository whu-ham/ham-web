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

import { getAcceptLanguageFromDocument } from '@/services/locale';

export const request = async <T>(
	path: string,
	init?: RequestInit
): Promise<T> => {
	const acceptLanguage = getAcceptLanguageFromDocument();
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
	const body: unknown = await res.json();
	// Unwrap the standard backend envelope { code, message, data }.
	// The BFF proxy streams the raw backend response, so client-side
	// responses carry the same envelope as the backend.
	const isEnvelope =
		typeof body === 'object' &&
		body !== null &&
		'code' in body &&
		'message' in body &&
		'data' in body;
	return (isEnvelope ? (body as { data: T }).data : body) as T;
};
