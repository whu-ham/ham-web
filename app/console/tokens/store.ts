/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/21
 *
 * Jotai atoms for the /console/tokens page.
 */

import { atom } from 'jotai';

import type { CreateTokenResponse, TokenListItem } from '@/services/token/api';

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

/** Token list */
export const tokenListAtom = atom<TokenListItem[]>([]);

/** List loading state */
export const tokenListLoadingAtom = atom<boolean>(true);

/** Whether the last fetch attempt failed */
export const tokenListErrorAtom = atom<boolean>(false);

/** Newly created / rotated token (shown only once) */
export const newlyCreatedTokenAtom = atom<CreateTokenResponse | null>(null);

/**
 * M3 fix: Version counter that increments on every create/rotate success.
 * useTokenList watches this to trigger a refetch, replacing the
 * `newlyCreated !== null` pattern which was confusing as an event signal.
 */
export const tokenListVersionAtom = atom(0);

/** Create modal visibility */
export const createModalVisibleAtom = atom<boolean>(false);

/** Rotate modal state */
export const rotateModalAtom = atom<{
	visible: boolean;
	tokenId: string | null;
}>({
	visible: false,
	tokenId: null,
});
