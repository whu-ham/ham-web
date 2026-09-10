/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:56:00
 *
 * Seed data shared by the e2e specs.
 *
 * Values intentionally mirror the shapes the app's TypeScript types
 * declare (see `services/token/api.ts` and `services/sso/api.ts`) so a
 * fixture that drifts from the contract shows up as a failing assertion
 * rather than as a silently empty screen.
 */
import type { StubToken } from '../stub/state.ts';
import type { StubConsentScope } from '../stub/state.ts';

/** The session value the stub backend treats as authenticated. */
export const VALID_SESSION = 'e2e-session';

/** Cookie name the app sends as its session. Mirrors SESSION_COOKIE. */
export const SESSION_COOKIE = 'ham_session';

/** User returned by /web/auth/me for the seeded session. */
export const ME = {
	user_id: 'u_e2e',
	nickname: 'E2E User',
	avatar_url: null,
} as const;

/** Redirect URI used by the SSO consent specs. */
export const REDIRECT_URI = 'https://example.com/callback';

/** Build a token fixture, filling in timestamps the UI only formats. */
export const makeToken = (overrides: Partial<StubToken> = {}): StubToken => ({
	id: 'tk_1',
	name: 'Cursor IDE',
	last4: 'a1b2',
	scopes: ['mcp'],
	last_used_at: null,
	expires_at: '2030-01-01T00:00:00.000Z',
	created_at: '2026-01-01T00:00:00.000Z',
	...overrides,
});

/** Scope fixtures covering required / optional / already-granted states. */
export const CONSENT_SCOPES: StubConsentScope[] = [
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
];
