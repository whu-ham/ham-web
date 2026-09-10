/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:55:00
 *
 * CLI entry point that boots the backend stub as a standalone process.
 *
 * Playwright runs `globalSetup` and spec files in separate processes, so
 * the stub cannot live inside the setup module — it is spawned here once
 * per test run and torn down in `global-teardown.ts`.
 */
import { startStubServer } from './server.ts';

const main = async (): Promise<void> => {
	const server = await startStubServer();
	// eslint-disable-next-line no-console -- startup notice is the process contract
	console.log(`[stub] listening on ${server.origin}`);

	const shutdown = () => {
		void server.close().then(() => process.exit(0));
	};
	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
};

void main().catch((error: unknown) => {
	console.error('[stub] failed to start', error);
	process.exit(1);
});
