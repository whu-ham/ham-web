/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:55:00
 *
 * Mutable state backing the backend stub.
 *
 * Tests flip the `xFails` flags and seed collections through the
 * `/__stub/**` control endpoints so a single server instance can serve
 * both happy paths and failure paths across specs.
 */

/** Shape of a token row as the frontend expects it. */
export interface StubToken {
	id: string;
	name: string;
	last4: string;
	scopes: string[];
	last_used_at: string | null;
	expires_at: string;
	created_at: string;
}

/** Scope entry returned by the consent-info endpoint. */
export interface StubConsentScope {
	scope: string;
	label: string;
	description: string;
	category: 'identity' | 'mcp' | 'other';
	already_granted: boolean;
	required: boolean;
}

export interface StubState {
	/** Cookie name the app forwards as its session. Mirrors SESSION_COOKIE. */
	sessionCookieName: string;
	/** Session value the stub treats as authenticated. */
	validSession: string;
	/**
	 * Payload returned by /web/auth/me.
	 * `nickname` is optional to mirror the app's `MeResponse`, which lets
	 * specs exercise the "no nickname" fallback path.
	 */
	me: { user_id: string; nickname?: string; avatar_url: string | null };

	/** Token table, reset between tests. */
	tokens: StubToken[];
	tokenIdSeq: number;
	/** Max tokens before POST returns 403 (matches the 12002 limit). */
	tokenLimit: number;
	/** Raw value of the most recently issued token, for reveal assertions. */
	lastCreatedRawToken: string;

	// Failure switches — each maps to one error branch in the UI.
	meFails: boolean;
	tokenListFails: boolean;
	tokenCreateFails: boolean;
	tokenRotateFails: boolean;
	tokenRevokeFails: boolean;
	qrCreateFails: boolean;
	consentInfoFails: boolean;
	consentConfirmFails: boolean;
	appCallbackFails: boolean;

	/** QR login state machine: PENDING → SCANNED → CONFIRMED / EXPIRED. */
	qrState: 'PENDING' | 'SCANNED' | 'CONFIRMED' | 'EXPIRED';
	qrTicket: string;
	qrTicketSeq: number;

	/** Consent screen fixtures. */
	consentApp: {
		client_id: string;
		name: string;
		description: string;
		icon_url: string;
		redirect_uri: string;
	};
	consentScopes: StubConsentScope[];
	consentNonce: string;
	canAutoAuthorize: boolean;
	/** Scopes the confirm endpoint received, for assertion. */
	lastConfirmedScopes: string[];
}

/** Restore every field to its default, ready for the next test. */
export const createStubState = (): StubState => ({
	sessionCookieName: 'ham_session',
	validSession: 'e2e-session',
	me: { user_id: 'u_e2e', nickname: 'E2E User', avatar_url: null },

	tokens: [],
	tokenIdSeq: 100,
	tokenLimit: 5,
	lastCreatedRawToken: '',

	meFails: false,
	tokenListFails: false,
	tokenCreateFails: false,
	tokenRotateFails: false,
	tokenRevokeFails: false,
	qrCreateFails: false,
	consentInfoFails: false,
	consentConfirmFails: false,
	appCallbackFails: false,

	qrState: 'PENDING',
	qrTicket: '',
	qrTicketSeq: 1,

	consentApp: {
		client_id: 'stub-app',
		name: 'Stub App',
		description: 'Third-party app used by the e2e suite',
		icon_url: '/icon.png',
		redirect_uri: 'https://example.com/callback',
	},
	consentScopes: [
		{
			scope: 'identity',
			label: 'Identity',
			description: 'Your Ham account identity',
			category: 'identity',
			already_granted: false,
			required: true,
		},
		{
			scope: 'mcp',
			label: 'MCP',
			description: 'Full MCP access (read + write)',
			category: 'mcp',
			already_granted: false,
			required: false,
		},
	],
	consentNonce: 'stub-nonce',
	canAutoAuthorize: false,
	lastConfirmedScopes: [],
});
