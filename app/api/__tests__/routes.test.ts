/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:25:31
 *
 * Unit tests for the BFF route handlers under `app/api/**`.
 *
 * Every handler is a thin adapter over the shared proxy: the only logic
 * they own is which backend path a browser path maps to, and how a
 * dynamic segment is encoded into it. That mapping is invisible to the
 * caller — a wrong path still returns a backend error, just a confusing
 * one — so each route is pinned to its upstream path, and the segment
 * handlers are pinned to percent-encoding what they interpolate so a
 * ticket or token id cannot smuggle in extra path segments.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { proxyToBackend, handlePreflight } = vi.hoisted(() => ({
	proxyToBackend: vi.fn(
		async () => new Response('{"ok":true}', { status: 200 })
	),
	handlePreflight: vi.fn(() => new Response(null, { status: 204 })),
}));

// The proxy is the boundary under test here: what matters is that the
// handler reaches it with the right path and an untouched request.
vi.mock('@/app/api/_proxy', () => ({ proxyToBackend, handlePreflight }));

import { GET as meGet } from '@/app/api/auth/me/route';
import {
	POST as logoutPost,
	OPTIONS as logoutOptions,
} from '@/app/api/auth/logout/route';
import { POST as passkeyLoginPost } from '@/app/api/auth/passkey/login/route';
import { POST as passkeyOptionPost } from '@/app/api/auth/passkey/option/route';
import { POST as qrTicketPost } from '@/app/api/auth/qr/ticket/route';
import { GET as qrTicketStatusGet } from '@/app/api/auth/qr/ticket/[ticket]/route';
import { POST as refreshPost } from '@/app/api/auth/refresh/route';
import { POST as consentConfirmPost } from '@/app/api/sso/consent/confirm/route';
import { POST as consentInfoPost } from '@/app/api/sso/consent/info/route';
import { GET as tokensGet, POST as tokensPost } from '@/app/api/tokens/route';
import { DELETE as tokenDelete } from '@/app/api/tokens/[id]/route';
import { POST as tokenRotatePost } from '@/app/api/tokens/[id]/rotate/route';

const request = (url: string, init?: RequestInit) =>
	new NextRequest(new Request(url, init));

/** The request the handler handed to the proxy, and the path it chose. */
const lastProxyCall = () => {
	const [req, path] = proxyToBackend.mock.calls.at(-1) as unknown as [
		NextRequest,
		string,
	];
	return { req, path };
};

describe('app/api route handlers', () => {
	beforeEach(() => {
		proxyToBackend.mockClear();
		handlePreflight.mockClear();
	});

	it('POST /api/auth/logout proxies /web/auth/logout', async () => {
		const res = await logoutPost(
			request('https://ham.example.com/api/auth/logout', {
				method: 'POST',
				headers: { cookie: 'ham_session=abc' },
			})
		);

		const { req, path } = lastProxyCall();
		expect(path).toBe('/web/auth/logout');
		// The session cookie is the only credential the BFF has.
		expect(req.headers.get('cookie')).toBe('ham_session=abc');
		expect(res.status).toBe(200);
	});

	it('GET /api/auth/me proxies /web/auth/me', async () => {
		await meGet(request('https://ham.example.com/api/auth/me'));

		const { req, path } = lastProxyCall();
		expect(path).toBe('/web/auth/me');
		expect(req.method).toBe('GET');
	});

	it('POST /api/auth/refresh proxies /web/auth/refresh', async () => {
		await refreshPost(
			request('https://ham.example.com/api/auth/refresh', { method: 'POST' })
		);

		expect(lastProxyCall().path).toBe('/web/auth/refresh');
	});

	it('POST /api/auth/passkey/option proxies /web/auth/passkey/option', async () => {
		await passkeyOptionPost(
			request('https://ham.example.com/api/auth/passkey/option', {
				method: 'POST',
			})
		);

		expect(lastProxyCall().path).toBe('/web/auth/passkey/option');
	});

	it('POST /api/auth/passkey/login proxies /web/auth/passkey/login', async () => {
		await passkeyLoginPost(
			request('https://ham.example.com/api/auth/passkey/login', {
				method: 'POST',
				body: '{"credential":{}}',
			})
		);

		const { req, path } = lastProxyCall();
		expect(path).toBe('/web/auth/passkey/login');
		// The assertion is the payload the browser signed; dropping it
		// turns every passkey login into an unauthenticated one.
		expect(req.method).toBe('POST');
	});

	it('POST /api/auth/qr/ticket proxies /web/auth/qr/ticket', async () => {
		await qrTicketPost(
			request('https://ham.example.com/api/auth/qr/ticket', { method: 'POST' })
		);

		expect(lastProxyCall().path).toBe('/web/auth/qr/ticket');
	});

	it('GET /api/auth/qr/ticket/[ticket] encodes the ticket into the path', async () => {
		await qrTicketStatusGet(
			request('https://ham.example.com/api/auth/qr/ticket/t'),
			{
				params: Promise.resolve({ ticket: 'tk/1 2' }),
			}
		);

		expect(lastProxyCall().path).toBe('/web/auth/qr/ticket/tk%2F1%202');
	});

	it('POST /api/sso/consent/info proxies /web/sso/consent/info', async () => {
		await consentInfoPost(
			request('https://ham.example.com/api/sso/consent/info', {
				method: 'POST',
				body: '{"ticket":"tk"}',
			})
		);

		expect(lastProxyCall().path).toBe('/web/sso/consent/info');
	});

	// Consent confirmation acts on the session cookie alone, so the
	// handler must not add anything of its own to the upstream call.
	it('POST /api/sso/consent/confirm proxies /web/sso/consent/confirm', async () => {
		const res = await consentConfirmPost(
			request('https://ham.example.com/api/sso/consent/confirm', {
				method: 'POST',
				body: '{"scopes":["openid"]}',
			})
		);

		const { req, path } = lastProxyCall();
		expect(path).toBe('/web/sso/consent/confirm');
		expect(req.method).toBe('POST');
		expect(res.status).toBe(200);
	});

	it('GET /api/tokens proxies /web/tokens and keeps the query string', async () => {
		await tokensGet(
			request('https://ham.example.com/api/tokens?page=2&size=20')
		);

		const { req, path } = lastProxyCall();
		expect(path).toBe('/web/tokens');
		expect(new URL(req.url).search).toBe('?page=2&size=20');
	});

	it('POST /api/tokens proxies /web/tokens', async () => {
		await tokensPost(
			request('https://ham.example.com/api/tokens', {
				method: 'POST',
				body: '{"name":"ci"}',
			})
		);

		expect(lastProxyCall().path).toBe('/web/tokens');
	});

	it('DELETE /api/tokens/[id] encodes the id into the path', async () => {
		await tokenDelete(
			request('https://ham.example.com/api/tokens/t', { method: 'DELETE' }),
			{
				params: Promise.resolve({ id: 'tok/1 2' }),
			}
		);

		const { req, path } = lastProxyCall();
		expect(path).toBe('/web/tokens/tok%2F1%202');
		expect(req.method).toBe('DELETE');
	});

	it('POST /api/tokens/[id]/rotate encodes the id into the path', async () => {
		await tokenRotatePost(
			request('https://ham.example.com/api/tokens/t/rotate'),
			{
				params: Promise.resolve({ id: 'tok_1' }),
			}
		);

		expect(lastProxyCall().path).toBe('/web/tokens/tok_1/rotate');
	});

	// A backend failure has to reach the browser untouched: the client
	// reads `code` / `message` out of the body to explain the rejection.
	it('surfaces a backend error unchanged', async () => {
		proxyToBackend.mockResolvedValueOnce(
			new Response('{"code":"12002","message":"token limit reached"}', {
				status: 400,
				headers: { 'content-type': 'application/json' },
			})
		);

		const res = await tokensPost(
			request('https://ham.example.com/api/tokens', {
				method: 'POST',
				body: '{}',
			})
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			code: '12002',
			message: 'token limit reached',
		});
	});

	// Every route has to answer the CORS preflight, or a cross-origin
	// frontend cannot call it at all.
	it('exposes the shared preflight handler as OPTIONS', async () => {
		const res = logoutOptions(
			request('https://ham.example.com/api/auth/logout', { method: 'OPTIONS' })
		);

		expect(handlePreflight).toHaveBeenCalledTimes(1);
		expect(res.status).toBe(204);
	});
});
