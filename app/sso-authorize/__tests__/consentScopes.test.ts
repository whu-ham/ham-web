/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/23 00:41:00
 *
 * Unit tests for the consent scope helpers — category grouping and the
 * required-scope rule that the confirm request depends on.
 */
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

	// A backend that sends no category must still land somewhere sensible:
	// an unknown scope is shown under identity rather than dropped, and a
	// category this screen does not model gets its own group.
	it('treats an uncategorised scope as identity', () => {
		const groups = groupConsentScopes([scope({ scope: 'email' })]);

		expect(groups).toEqual([
			{
				category: 'identity',
				scopes: [expect.objectContaining({ scope: 'email' })],
			},
		]);
	});

	it('keeps an unmodelled category in its own group', () => {
		const groups = groupConsentScopes([
			scope({ scope: 'billing:read', category: 'billing' }),
		]);

		expect(groups).toEqual([
			{
				category: 'other',
				scopes: [expect.objectContaining({ scope: 'billing:read' })],
			},
		]);
	});

	// The screen only renders groups that have members, so an empty
	// category must not produce an empty section.
	it('omits categories with no scopes', () => {
		const groups = groupConsentScopes([scope({ scope: 'openid' })]);

		expect(groups.map((group) => group.category)).toEqual(['identity']);
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
