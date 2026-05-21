/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * HTTP client for the /web/tokens/** endpoints (API token management).
 * Uses shared request<T>() and ApiError from services/shared.ts.
 */
'use client';

import { request } from '@/services/shared';

// Re-export ApiError for consumer convenience
export { ApiError } from '@/services/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid scope values exposed in the UI */
export const VALID_SCOPES = ['mcp', 'mcp:read', 'mcp:write'] as const;
export type ValidScope = (typeof VALID_SCOPES)[number];

export interface CreateTokenRequest {
	name: string;
	scopes: ValidScope[];
	ttl_days: number;
}

export interface CreateTokenResponse {
	id: string;
	name: string;
	token: string; // Only returned on create/rotate
	scopes: string[];
	expires_at: string;
	created_at: string;
}

export interface TokenListItem {
	id: string;
	name: string;
	last4: string;
	scopes: string[];
	last_used_at: string | null;
	expires_at: string;
	created_at: string;
}

export interface ListTokensResponse {
	tokens: TokenListItem[];
}

export interface RotateTokenRequest {
	ttl_days: number;
}

// ---------------------------------------------------------------------------
// API object
// ---------------------------------------------------------------------------

export const TokenApi = {
	list: () => request<ListTokensResponse>('/tokens'),
	create: (body: CreateTokenRequest) =>
		request<CreateTokenResponse>('/tokens', {
			method: 'POST',
			body: JSON.stringify(body),
		}),
	rotate: (id: string, body: RotateTokenRequest) =>
		request<CreateTokenResponse>(`/tokens/${encodeURIComponent(id)}/rotate`, {
			method: 'POST',
			body: JSON.stringify(body),
		}),
	revoke: (id: string) =>
		request<void>(`/tokens/${encodeURIComponent(id)}`, {
			method: 'DELETE',
		}),
};
