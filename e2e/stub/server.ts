/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:55:00
 *
 * HTTP server wrapping the stub handlers and exposing control endpoints.
 *
 * `/__stub/**` is the test-only surface (state reset, failure injection,
 * fixture seeding). It never overlaps with `/web/**`, which the app calls,
 * so a misrouted request fails loudly instead of silently mocking itself.
 */
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from 'node:http';

import { handleBackendRequest } from './handlers.ts';
import { createStubState, type StubState } from './state.ts';
import { STUB_PORT } from './port.ts';

export interface StubServer {
	/** Origin the app should use as HAM_BACKEND_ORIGIN, e.g. http://127.0.0.1:4123. */
	origin: string;
	state: StubState;
	close: () => Promise<void>;
}

const readBody = async (req: IncomingMessage): Promise<string> => {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
};

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify(body ?? {}));
};

/**
 * Handle a `/__stub/**` control request. Supported routes:
 *   POST /__stub/reset         — restore all state to defaults
 *   POST /__stub/state         — shallow-merge a partial state patch
 *   GET  /__stub/state         — read current state (debugging)
 */
const handleControlRequest = async (
	req: IncomingMessage,
	res: ServerResponse,
	state: StubState
): Promise<void> => {
	const url = new URL(req.url ?? '/', 'http://stub.local');
	const method = (req.method ?? 'GET').toUpperCase();

	if (url.pathname === '/__stub/reset' && method === 'POST') {
		Object.assign(state, createStubState());
		return sendJson(res, 200, { ok: true });
	}

	if (url.pathname === '/__stub/setup' && method === 'POST') {
		// Atomic reset + patch. See `setupStub` in control.ts for why this
		// must happen inside the server rather than as two client calls.
		let patch: Partial<StubState> = {};
		const raw = await readBody(req);
		if (raw.trim()) {
			try {
				patch = JSON.parse(raw) as Partial<StubState>;
			} catch {
				return sendJson(res, 400, { ok: false, error: 'invalid JSON patch' });
			}
		}
		Object.assign(state, createStubState(), patch);
		return sendJson(res, 200, { ok: true });
	}

	if (url.pathname === '/__stub/state' && method === 'POST') {
		const raw = await readBody(req);
		try {
			const patch = JSON.parse(raw) as Partial<StubState>;
			Object.assign(state, patch);
			return sendJson(res, 200, { ok: true });
		} catch {
			return sendJson(res, 400, { ok: false, error: 'invalid JSON patch' });
		}
	}

	if (url.pathname === '/__stub/state' && method === 'GET') {
		return sendJson(res, 200, state);
	}

	return sendJson(res, 404, { ok: false, error: 'unknown control route' });
};

/** Start the stub backend on the shared STUB_PORT. */
export const startStubServer = async (): Promise<StubServer> => {
	const state = createStubState();

	const server = createServer((req, res) => {
		const path = (req.url ?? '/').split('?')[0];
		const route = path.startsWith('/__stub/')
			? handleControlRequest(req, res, state)
			: handleBackendRequest(req, res, state);
		void route.catch((error: unknown) => {
			res.writeHead(500, { 'Content-Type': 'application/json' });
			res.end(
				JSON.stringify({
					code: '500',
					message: error instanceof Error ? error.message : 'stub error',
				})
			);
		});
	});

	await new Promise<void>((resolve) => {
		server.listen(STUB_PORT, '127.0.0.1', resolve);
	});

	const address = server.address();
	if (typeof address === 'string' || address === null) {
		throw new Error('stub server failed to bind a port');
	}

	return {
		origin: `http://127.0.0.1:${address.port}`,
		state,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
			}),
	};
};
