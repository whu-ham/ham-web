/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:55:00
 *
 * Client for the stub backend's `/__stub/**` control endpoints, used by
 * fixtures and specs to arrange fixtures and inject failures.
 *
 * The stub runs in its own process, so all mutation happens over HTTP
 * rather than by sharing in-memory objects.
 */
import { STUB_ORIGIN } from './port.ts';
import type { StubState } from './state.ts';

/** Reset all stub state to defaults. Call before each test. */
export const resetStub = async (): Promise<void> => {
	const res = await fetch(`${STUB_ORIGIN}/__stub/reset`, { method: 'POST' });
	if (!res.ok) throw new Error(`stub reset failed: ${res.status}`);
};

/**
 * Shallow-merge a partial patch into the current stub state.
 *
 * Only for mid-test mutations that must preserve state the test already
 * arranged (e.g. flipping a failure switch off while keeping seeded
 * rows). To arrange state at the start of a test, use {@link setupStub}.
 */
export const patchStub = async (patch: Partial<StubState>): Promise<void> => {
	const res = await fetch(`${STUB_ORIGIN}/__stub/state`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(patch),
	});
	if (!res.ok) throw new Error(`stub patch failed: ${res.status}`);
};

/**
 * Reset the stub, then apply a patch in one round-trip.
 *
 * Specs should arrange state through this rather than `patchStub` alone:
 * a global `beforeEach` reset is not a reliable isolation boundary,
 * because a request from the previous test can still be in flight when
 * the next test patches, and would then be clobbered. Doing reset+patch
 * server-side makes the arrangement atomic.
 */
export const setupStub = async (
	patch: Partial<StubState> = {}
): Promise<void> => {
	const res = await fetch(`${STUB_ORIGIN}/__stub/setup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(patch),
	});
	if (!res.ok) throw new Error(`stub setup failed: ${res.status}`);
};

/** Read the current stub state (useful when debugging a failing spec). */
export const readStub = async (): Promise<StubState> => {
	const res = await fetch(`${STUB_ORIGIN}/__stub/state`);
	return (await res.json()) as StubState;
};
