/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * Jotai atoms for the /console/apikeys page.
 */

import { atom } from 'jotai';

import type {
	CreateTokenResponse,
	TokenListItem,
} from '@/services/token/api';

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

/** Token list */
export const tokenListAtom = atom<TokenListItem[]>([]);

/** List loading state */
export const tokenListLoadingAtom = atom<boolean>(true);

/** Newly created / rotated token (shown only once) */
export const newlyCreatedTokenAtom = atom<CreateTokenResponse | null>(null);

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
