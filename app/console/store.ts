/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * Jotai atoms for the /console page.
 */

import { atom } from 'jotai';

import { MeResponse } from '@/services/sso/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConsoleStage =
	| { kind: 'loading' }
	| { kind: 'login' }
	| { kind: 'console'; me: MeResponse };

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

/** Current page stage */
export const consoleStageAtom = atom<ConsoleStage>({ kind: 'loading' });
