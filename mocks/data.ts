/**
 * Shared mock data for token and auth API.
 * Used by both MSW handlers (client) and server-side data fetching (SSR).
 */

const now = Date.now();
const dayMs = 86_400_000;

const futureDate = (days: number) => new Date(now + days * dayMs).toISOString();

export const mockTokenList = [
	{
		id: 'tk_1',
		name: 'Cursor IDE',
		last4: 'a1b2',
		scopes: ['mcp'],
		last_used_at: new Date(now - 2 * dayMs).toISOString(),
		expires_at: futureDate(28),
		created_at: new Date(now - 5 * dayMs).toISOString(),
	},
	{
		id: 'tk_2',
		name: 'Claude Code',
		last4: 'c3d4',
		scopes: ['mcp:read'],
		last_used_at: null,
		expires_at: futureDate(15),
		created_at: new Date(now - 3 * dayMs).toISOString(),
	},
	{
		id: 'tk_3',
		name: 'CI/CD Pipeline',
		last4: 'e5f6',
		scopes: ['mcp:read', 'mcp:write'],
		last_used_at: new Date(now - dayMs).toISOString(),
		expires_at: futureDate(7),
		created_at: new Date(now - 10 * dayMs).toISOString(),
	},
];

export const mockMe = {
	user_id: 'u_mock_001',
	nickname: '小明',
	avatar_url: undefined,
};
