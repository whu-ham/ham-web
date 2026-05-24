import { describe, expect, it } from 'vitest';

import {
	groupConsentScopes,
	withRequiredConsentScopes,
} from '@/app/sso-authorize/consentScopes';
import type { ConsentScopeDetail } from '@/services/sso/api';

const scope = (
	overrides: Partial<ConsentScopeDetail> & Pick<ConsentScopeDetail, 'scope'>
): ConsentScopeDetail => ({
	description: overrides.scope,
	already_granted: false,
	required: false,
	...overrides,
});

describe('groupConsentScopes', () => {
	it('separates identity/profile scopes from MCP scopes', () => {
		const groups = groupConsentScopes([
			scope({ scope: 'openid', category: 'identity' }),
			scope({ scope: 'profile', category: 'profile' }),
			scope({ scope: 'mcp:read', category: 'mcp' }),
			scope({ scope: 'mcp:write', category: 'mcp' }),
		]);

		expect(groups).toEqual([
			{
				category: 'identity',
				scopes: [
					expect.objectContaining({ scope: 'openid' }),
					expect.objectContaining({ scope: 'profile' }),
				],
			},
			{
				category: 'mcp',
				scopes: [
					expect.objectContaining({ scope: 'mcp:read' }),
					expect.objectContaining({ scope: 'mcp:write' }),
				],
			},
		]);
	});

	it('falls back to MCP grouping for mcp-prefixed scopes', () => {
		const groups = groupConsentScopes([scope({ scope: 'mcp:write' })]);

		expect(groups).toEqual([
			{
				category: 'mcp',
				scopes: [expect.objectContaining({ scope: 'mcp:write' })],
			},
		]);
	});
});

describe('withRequiredConsentScopes', () => {
	it('keeps required scopes checked even when omitted by the UI event', () => {
		const result = withRequiredConsentScopes(
			['mcp:read'],
			[
				scope({ scope: 'openid', required: true }),
				scope({ scope: 'mcp:read' }),
				scope({ scope: 'mcp:write' }),
			]
		);

		expect(result).toContain('openid');
		expect(result).toContain('mcp:read');
		expect(result).not.toContain('mcp:write');
	});
});
