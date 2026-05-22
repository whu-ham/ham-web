/**
 * s6: Unit tests for safeRedirect — validates redirect URL safety.
 */
import { describe, expect, it } from 'vitest';

// We need to test safeRedirect without env var set (relative-only mode)
// Import directly — the module reads env at import time so we test the
// default (safest) behavior.
import { safeRedirect } from '@/services/redirect';

describe('safeRedirect', () => {
	it('returns fallback for null/undefined/empty', () => {
		expect(safeRedirect(null)).toBe('/console');
		expect(safeRedirect(undefined)).toBe('/console');
		expect(safeRedirect('')).toBe('/console');
	});

	it('accepts valid relative paths', () => {
		expect(safeRedirect('/console')).toBe('/console');
		expect(safeRedirect('/console/tokens')).toBe('/console/tokens');
		expect(safeRedirect('/sso-authorize?client_id=foo')).toBe('/sso-authorize?client_id=foo');
		expect(safeRedirect('/')).toBe('/');
	});

	it('rejects protocol-relative URLs', () => {
		expect(safeRedirect('//evil.com')).toBe('/console');
	});

	it('rejects backslash-encoded paths', () => {
		expect(safeRedirect('/\\evil.com')).toBe('/console');
	});

	it('rejects absolute URLs when no allowed hosts configured', () => {
		expect(safeRedirect('https://ham.nowcent.cn/console')).toBe('/console');
		expect(safeRedirect('http://localhost:3000/console')).toBe('/console');
	});

	it('rejects javascript: URLs', () => {
		expect(safeRedirect('javascript:alert(1)')).toBe('/console');
	});

	it('rejects percent-encoded protocol-relative URLs', () => {
		expect(safeRedirect('%2F%2Fevil.com')).toBe('/console');
	});

	it('uses custom fallback', () => {
		expect(safeRedirect(null, '/home')).toBe('/home');
		expect(safeRedirect('//evil.com', '/home')).toBe('/home');
	});
});
