/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:55:00
 *
 * In-memory backend stub driving the e2e suite.
 *
 * Why a stub server instead of MSW? The app's Server Components call the
 * backend directly through `serverFetch` (`${HAM_BACKEND_ORIGIN}/web/**`),
 * which never touches `/api/**` and therefore cannot be intercepted by a
 * browser-side service worker. Standing up a real HTTP server keeps SSR,
 * the BFF proxy, cookie forwarding and Set-Cookie handling all in play, so
 * the suite exercises the production code path rather than a mocked twin.
 *
 * Each route reads its behaviour from the shared {@link StubState}, which
 * tests mutate through the `/__stub/**` control endpoints exposed by
 * {@link StubServer}. That is what lets one suite cover both the happy path
 * and the error path without touching application code.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { createStubState, type StubState } from './state.ts';

/** Standard backend success envelope. */
const ok = <T>(data: T) => ({ code: '200', message: '', data });

/** Standard backend failure envelope. */
const fail = (code: string, message: string) => ({ code, message });

/** Read a JSON request body, tolerating empty bodies. */
const readJson = async <T>(req: IncomingMessage): Promise<T | null> => {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	if (chunks.length === 0) return null;
	const raw = Buffer.concat(chunks).toString('utf8');
	if (!raw.trim()) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
};

const send = (res: ServerResponse, status: number, body?: unknown): void => {
	if (status === 204) {
		res.writeHead(204).end();
		return;
	}
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify(body ?? {}));
};

/** True when the request carries a session the stub considers valid. */
const isAuthed = (req: IncomingMessage, state: StubState): boolean => {
	const cookies = req.headers.cookie ?? '';
	return cookies
		.split(';')
		.map((c) => c.trim())
		.some((c) => c === `${state.sessionCookieName}=${state.validSession}`);
};

const dayMs = 86_400_000;
const inDays = (days: number) =>
	new Date(Date.now() + days * dayMs).toISOString();

const randomToken = (): string => {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let out = 'ham_';
	for (let i = 0; i < 40; i++) {
		out += chars[Math.floor(Math.random() * chars.length)];
	}
	return out;
};

/** Routes every backend request to its handler. */
export const handleBackendRequest = async (
	req: IncomingMessage,
	res: ServerResponse,
	state: StubState
): Promise<void> => {
	const url = new URL(req.url ?? '/', 'http://stub.local');
	const { pathname } = url;
	const method = (req.method ?? 'GET').toUpperCase();

	if (pathname === '/web/auth/me') {
		if (state.meFails) return send(res, 500, fail('500', 'me boom'));
		if (!isAuthed(req, state)) {
			return send(res, 401, fail('401', 'unauthenticated'));
		}
		return send(res, 200, state.me);
	}

	if (pathname === '/web/auth/logout') {
		// Real backends expire the session here; without this the browser
		// keeps the cookie and logout appears to do nothing.
		res.setHeader(
			'Set-Cookie',
			`${state.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
		);
		return send(res, 204);
	}

	if (pathname === '/web/auth/refresh') {
		return send(res, 204);
	}

	if (pathname === '/web/auth/qr/ticket' && method === 'POST') {
		if (state.qrCreateFails) {
			return send(res, 500, fail('500', 'ticket create failed'));
		}
		state.qrTicket = `tk_${state.qrTicketSeq++}`;
		// Deliberately does not reset qrState: a spec may have preset
		// SCANNED / CONFIRMED / EXPIRED, and the client re-creates a
		// ticket on refresh, which would otherwise clobber that.
		return send(res, 200, ok({ ticket: state.qrTicket, expires_in: 300 }));
	}

	if (pathname.startsWith('/web/auth/qr/ticket/')) {
		const ticket = pathname.slice('/web/auth/qr/ticket/'.length);
		if (ticket !== state.qrTicket) {
			return send(res, 200, ok({ state: 'INVALID' }));
		}
		const body: Record<string, unknown> = {
			state: state.qrState,
			expires_in: 300,
		};
		if (state.qrState === 'SCANNED') {
			body.scan_user_info = { nickname: state.me.nickname };
		}
		if (state.qrState === 'CONFIRMED') {
			body.user_info = state.me;
			res.setHeader(
				'Set-Cookie',
				`${state.sessionCookieName}=${state.validSession}; Path=/; HttpOnly; SameSite=Lax`
			);
		}
		return send(res, 200, ok(body));
	}

	if (pathname === '/web/tokens' && method === 'GET') {
		if (state.tokenListFails) {
			return send(res, 500, fail('500', 'token list boom'));
		}
		if (!isAuthed(req, state)) {
			return send(res, 401, fail('401', 'unauthenticated'));
		}
		return send(res, 200, ok(state.tokens));
	}

	if (pathname === '/web/tokens' && method === 'POST') {
		if (!isAuthed(req, state)) {
			return send(res, 401, fail('401', 'unauthenticated'));
		}
		const body = await readJson<{
			name?: string;
			scopes?: string[];
			ttl_days?: number;
		}>(req);
		if (state.tokenCreateFails) {
			return send(res, 500, fail('500', 'create boom'));
		}
		if (state.tokens.length >= state.tokenLimit) {
			return send(res, 403, fail('12002', 'token limit reached'));
		}
		if (!body?.name?.trim()) {
			return send(res, 400, fail('12001', 'name is required'));
		}
		const raw = randomToken();
		const item = {
			id: `tk_${state.tokenIdSeq++}`,
			name: body.name.trim(),
			last4: raw.slice(-4),
			scopes: body.scopes ?? [],
			last_used_at: null,
			expires_at: inDays(body.ttl_days ?? 30),
			created_at: new Date().toISOString(),
		};
		state.tokens.push(item);
		state.lastCreatedRawToken = raw;
		return send(res, 200, ok({ raw_token: raw, token: item }));
	}

	const rotateMatch = /^\/web\/tokens\/([^/]+)\/rotate$/.exec(pathname);
	if (rotateMatch && method === 'POST') {
		if (!isAuthed(req, state)) {
			return send(res, 401, fail('401', 'unauthenticated'));
		}
		const body = await readJson<{ ttl_days?: number }>(req);
		const item = state.tokens.find((t) => t.id === rotateMatch[1]);
		if (!item) return send(res, 404, fail('12004', 'token not found'));
		if (state.tokenRotateFails) {
			return send(res, 500, fail('500', 'rotate boom'));
		}
		const raw = randomToken();
		item.last4 = raw.slice(-4);
		item.expires_at = inDays(body?.ttl_days ?? 30);
		state.lastCreatedRawToken = raw;
		return send(res, 200, ok({ raw_token: raw, token: { ...item } }));
	}

	const tokenById = /^\/web\/tokens\/([^/]+)$/.exec(pathname);
	if (tokenById && method === 'DELETE') {
		if (!isAuthed(req, state)) {
			return send(res, 401, fail('401', 'unauthenticated'));
		}
		if (state.tokenRevokeFails) {
			return send(res, 500, fail('500', 'revoke boom'));
		}
		const idx = state.tokens.findIndex((t) => t.id === tokenById[1]);
		if (idx === -1) return send(res, 404, fail('12004', 'token not found'));
		state.tokens.splice(idx, 1);
		return send(res, 204);
	}

	if (pathname === '/web/sso/consent/info' && method === 'POST') {
		if (!isAuthed(req, state)) {
			return send(res, 401, fail('401', 'unauthenticated'));
		}
		if (state.consentInfoFails) {
			return send(res, 500, fail('500', 'consent info boom'));
		}
		const body = await readJson<{ scope?: string[] }>(req);
		const requested = body?.scope ?? [];
		const scopes = state.consentScopes.filter(
			(s) => requested.length === 0 || requested.includes(s.scope)
		);
		return send(
			res,
			200,
			ok({
				app: state.consentApp,
				scopes,
				can_auto_authorize: state.canAutoAuthorize,
				nonce: state.consentNonce,
			})
		);
	}

	if (pathname === '/web/sso/consent/confirm' && method === 'POST') {
		if (!isAuthed(req, state)) {
			return send(res, 401, fail('401', 'unauthenticated'));
		}
		const body = await readJson<{ state?: string; scope?: string[] }>(req);
		if (state.consentConfirmFails) {
			return send(res, 500, fail('500', 'consent confirm boom'));
		}
		state.lastConfirmedScopes = body?.scope ?? [];
		const target = new URL(state.consentApp.redirect_uri);
		target.searchParams.set('code', 'stub-auth-code');
		if (body?.state) target.searchParams.set('state', body.state);
		return send(res, 200, ok({ redirect_url: target.toString() }));
	}

	if (pathname === '/web/auth/app-callback' && method === 'POST') {
		const body = await readJson<{ code?: string }>(req);
		if (state.appCallbackFails || body?.code === 'bad-code') {
			return send(res, 400, fail('12010', 'invalid code'));
		}
		res.setHeader(
			'Set-Cookie',
			`${state.sessionCookieName}=${state.validSession}; Path=/; HttpOnly; SameSite=Lax`
		);
		return send(res, 200, ok({ ok: true }));
	}

	return send(res, 404, fail('404', `no stub route for ${method} ${pathname}`));
};

/** Re-exported so the server module can seed defaults without duplicating data. */
export { createStubState, inDays };
export type { StubState };
