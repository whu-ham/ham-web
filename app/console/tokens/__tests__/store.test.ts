/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:33:00
 *
 * Unit tests for the jotai atoms shared by the token console.
 *
 * The defaults are the contract the page renders against: the list starts
 * empty *and* loading so the first paint is a skeleton rather than an
 * "you have no tokens" empty state, the error flag starts down, and the
 * version counter starts at 0 because it is a signal, not data — a mount
 * compares against it to decide whether a refetch is owed.
 *
 * The atoms are also shared across route visits, so a value written by one
 * page (or one test) must not leak into the next store that reads them.
 */
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';

import {
	createModalVisibleAtom,
	newlyCreatedTokenAtom,
	rotateModalAtom,
	tokenListAtom,
	tokenListErrorAtom,
	tokenListLoadingAtom,
	tokenListVersionAtom,
} from '@/app/console/tokens/store';
import type { CreateTokenResponse, TokenListItem } from '@/services/token/api';

const ITEM: TokenListItem = {
	id: 'tok_1',
	name: 'ci',
	last4: 'abcd',
	scopes: ['mcp'],
	last_used_at: null,
	expires_at: '2026-10-26T00:00:00Z',
	created_at: '2026-9-26T00:00:00Z',
};

const CREATED: CreateTokenResponse = {
	raw_token: 'ham_sk_live_raw',
	token: {
		id: 'tok_1',
		name: 'ci',
		last4: 'abcd',
		scopes: ['mcp'],
		expires_at: '2026-10-26T00:00:00Z',
		created_at: '2026-9-26T00:00:00Z',
	},
};

describe('token console atoms', () => {
	it('start every store from the documented defaults', () => {
		const store = createStore();

		expect(store.get(tokenListAtom)).toEqual([]);
		// Loading, not empty: the first paint is a skeleton, and an empty
		// list is only ever something a fetch actually returned.
		expect(store.get(tokenListLoadingAtom)).toBe(true);
		expect(store.get(tokenListErrorAtom)).toBe(false);
		expect(store.get(newlyCreatedTokenAtom)).toBe(null);
		expect(store.get(tokenListVersionAtom)).toBe(0);
		expect(store.get(createModalVisibleAtom)).toBe(false);
		expect(store.get(rotateModalAtom)).toEqual({
			visible: false,
			tokenId: null,
		});
	});

	it('keep their defaults in a fresh store after another was written', () => {
		const first = createStore();
		first.set(tokenListAtom, [ITEM]);
		first.set(tokenListLoadingAtom, false);
		first.set(tokenListErrorAtom, true);
		first.set(newlyCreatedTokenAtom, CREATED);
		first.set(tokenListVersionAtom, 4);
		first.set(createModalVisibleAtom, true);
		first.set(rotateModalAtom, { visible: true, tokenId: 'tok_1' });

		const second = createStore();

		// The atoms outlive the page, so a value from a previous visit must
		// not be what the next mount reads as its starting point.
		expect(second.get(tokenListAtom)).toEqual([]);
		expect(second.get(tokenListLoadingAtom)).toBe(true);
		expect(second.get(tokenListErrorAtom)).toBe(false);
		expect(second.get(newlyCreatedTokenAtom)).toBe(null);
		expect(second.get(tokenListVersionAtom)).toBe(0);
		expect(second.get(createModalVisibleAtom)).toBe(false);
		expect(second.get(rotateModalAtom)).toEqual({
			visible: false,
			tokenId: null,
		});
	});

	it('let the version counter be bumped by an updater', () => {
		const store = createStore();

		store.set(tokenListVersionAtom, (v) => v + 1);
		store.set(tokenListVersionAtom, (v) => v + 1);

		// The list compares this against the version it has already seen, so
		// it has to move by one per create/rotate — never reset.
		expect(store.get(tokenListVersionAtom)).toBe(2);
	});
});
