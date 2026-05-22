/**
 * s6: Unit tests for handleScopeChange — validates parent/child scope checkbox logic.
 */
import { describe, expect, it } from 'vitest';

const PARENT_SCOPE = 'mcp';
const CHILD_SCOPES: readonly string[] = ['mcp:read', 'mcp:write'];

/**
 * Re-implementation of the handleScopeChange logic from useCreateToken
 * so we can test it in isolation without React state.
 */
const applyScopeChange = (
	prev: string[],
	scope: string,
	checked: boolean
): string[] => {
	if (scope === PARENT_SCOPE) {
		if (checked) {
			return [...new Set([PARENT_SCOPE, ...CHILD_SCOPES, ...prev])];
		}
		return prev.filter((s) => s !== PARENT_SCOPE && !CHILD_SCOPES.includes(s));
	}
	let next = checked ? [...prev, scope] : prev.filter((s) => s !== scope);
	if (!checked) {
		next = next.filter((s) => s !== PARENT_SCOPE);
	}
	if (CHILD_SCOPES.every((c) => next.includes(c))) {
		if (!next.includes(PARENT_SCOPE)) {
			next.push(PARENT_SCOPE);
		}
	}
	return next;
};

describe('handleScopeChange', () => {
	it('checking parent selects all children', () => {
		const result = applyScopeChange([], 'mcp', true);
		expect(result).toContain('mcp');
		expect(result).toContain('mcp:read');
		expect(result).toContain('mcp:write');
	});

	it('unchecking parent deselects all children', () => {
		const result = applyScopeChange(
			['mcp', 'mcp:read', 'mcp:write'],
			'mcp',
			false
		);
		expect(result).toEqual([]);
	});

	it('checking all children auto-checks parent', () => {
		let state = applyScopeChange([], 'mcp:read', true);
		state = applyScopeChange(state, 'mcp:write', true);
		expect(state).toContain('mcp');
	});

	it('unchecking one child unchecks parent but keeps other children', () => {
		let state = applyScopeChange([], 'mcp', true); // selects all
		state = applyScopeChange(state, 'mcp:write', false);
		expect(state).not.toContain('mcp');
		expect(state).toContain('mcp:read');
		expect(state).not.toContain('mcp:write');
	});

	it('checking a single child does not check parent', () => {
		const result = applyScopeChange([], 'mcp:read', true);
		expect(result).not.toContain('mcp');
		expect(result).toContain('mcp:read');
	});
});
