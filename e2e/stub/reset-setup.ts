/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 16:45:00
 *
 * Forces the backend stub into a clean state before the run.
 *
 * The per-test reset lives in the page fixtures, but that only helps
 * while a run is healthy: if a run is interrupted — a failed assertion,
 * a killed process — the stub keeps whatever state the last test set,
 * including failure switches that make every subsequent request fail.
 * The next run then starts against a poisoned backend, which looks like
 * a broken app rather than leftover state.
 *
 * Resetting once up front makes each run independent of the last.
 */
import { resetStub } from './control.ts';

const globalSetup = async (): Promise<void> => {
	await resetStub();
};

export default globalSetup;
