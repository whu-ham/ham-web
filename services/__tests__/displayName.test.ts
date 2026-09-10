/**
 * Unit tests for displayName — the user-id fallback for display names.
 *
 * `??` is not sufficient because the backend can return an empty or
 * whitespace-only nickname, which is not nullish and would otherwise
 * render a blank name.
 */
import { describe, expect, it } from 'vitest';

import { displayName } from '@/services/sso/api';

describe('displayName', () => {
	it('prefers the nickname when present', () => {
		expect(displayName({ user_id: 'u_1', nickname: 'Ada' })).toBe('Ada');
	});

	it('falls back to the user id when the nickname is absent', () => {
		expect(displayName({ user_id: 'u_1' })).toBe('u_1');
	});

	it('falls back to the user id when the nickname is empty', () => {
		expect(displayName({ user_id: 'u_1', nickname: '' })).toBe('u_1');
	});

	it('falls back to the user id when the nickname is whitespace only', () => {
		expect(displayName({ user_id: 'u_1', nickname: '   ' })).toBe('u_1');
		expect(displayName({ user_id: 'u_1', nickname: '\t\n' })).toBe('u_1');
	});

	it('trims surrounding whitespace from a real nickname', () => {
		expect(displayName({ user_id: 'u_1', nickname: '  Ada  ' })).toBe('Ada');
	});

	it('returns an empty string when there is no user', () => {
		expect(displayName(null)).toBe('');
		expect(displayName(undefined)).toBe('');
	});
});
