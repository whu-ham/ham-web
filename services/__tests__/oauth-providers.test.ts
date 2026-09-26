/**
 * @author Claude
 * @version 1.2
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the browser OAuth provider registry.
 *
 * Covers the QQ flow in particular: it uses the authorization-code grant
 * so the backend can redeem the code with the Web app's own appkey, and
 * its callback URL must line up with the redirect_uri sent upstream.
 *
 * Also pins the per-provider query shapes. Client ids are Worker vars,
 * so they are read at call time: an unset provider still has to route
 * (with an empty client_id) instead of crashing the login page.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	buildLoginOAuthCallbackPath,
	buildLoginOAuthCallbackUrl,
	buildLoginOAuthStartHref,
	getOAuthProviderConfig,
	isOAuthProvider,
	OAUTH_PROVIDER_CONFIGS,
	OAUTH_PROVIDER_IDS,
	type OAuthProvider,
} from '@/services/oauth-providers';

const ORIGIN = 'https://ham.example.com';

const authorizeUrlFor = (
	provider: OAuthProvider,
	env: Record<string, string>
) => {
	for (const [key, value] of Object.entries(env)) {
		vi.stubEnv(key, value);
	}
	const config = getOAuthProviderConfig(provider);
	if (!config) throw new Error(`missing config for ${provider}`);
	const url = new URL(
		config.buildAuthorizeUrl({
			callbackUrl: buildLoginOAuthCallbackUrl(ORIGIN, provider),
			state: 'state-123',
		})
	);
	return { url, search: url.searchParams };
};

describe('oauth-providers', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('registers qq, github, apple and soruxgpt', () => {
		expect(OAUTH_PROVIDER_IDS).toEqual(['qq', 'github', 'apple', 'soruxgpt']);
	});

	it('registers a config for every provider id', () => {
		for (const id of OAUTH_PROVIDER_IDS) {
			expect(OAUTH_PROVIDER_CONFIGS[id].id).toBe(id);
			expect(OAUTH_PROVIDER_CONFIGS[id].accentClassName).toBeTruthy();
		}
	});

	// The backend redeems the code server-side with the Web app's appkey,
	// which only exists for the authorization-code grant. Implicit grant
	// would hand the browser a finished access token instead.
	it('requests an authorization code from QQ', () => {
		const { url, search } = authorizeUrlFor('qq', {
			QQ_CLIENT_ID: 'qq-web-appid',
		});

		expect(url.origin + url.pathname).toBe(
			'https://graph.qq.com/oauth2.0/authorize'
		);
		expect(search.get('response_type')).toBe('code');
		expect(search.get('client_id')).toBe('qq-web-appid');
		expect(search.get('scope')).toBe('get_user_info');
		expect(search.get('state')).toBe('state-123');
	});

	// QQ rejects the code exchange unless this matches the redirect_uri
	// used to obtain the code, so both sides must derive it the same way.
	it('sends the absolute callback url as the QQ redirect_uri', () => {
		const { search } = authorizeUrlFor('qq', {
			QQ_CLIENT_ID: 'qq-web-appid',
		});

		expect(search.get('redirect_uri')).toBe(
			`${ORIGIN}${buildLoginOAuthCallbackPath('qq')}`
		);
		expect(search.get('redirect_uri')).toBe(
			`${ORIGIN}/login/oauth/qq/callback`
		);
	});

	it('keeps QQ on a same-site callback', () => {
		const config = getOAuthProviderConfig('qq');
		expect(config?.crossSiteCallback).toBe(false);
	});

	// GitHub omits `response_type` on purpose: its authorize endpoint only
	// ever issues an authorization code, so there is no implicit-grant
	// variant to opt out of. Pinning the exact query shape keeps a later
	// `response_type=token` from sneaking in unnoticed.
	it('requests an authorization code from GitHub', () => {
		const { url, search } = authorizeUrlFor('github', {
			GITHUB_CLIENT_ID: 'gh-web-client',
		});

		expect(url.origin + url.pathname).toBe(
			'https://github.com/login/oauth/authorize'
		);
		expect([...search.keys()].sort()).toEqual([
			'client_id',
			'redirect_uri',
			'scope',
			'state',
		]);
		expect(search.get('client_id')).toBe('gh-web-client');
		expect(search.get('scope')).toBe('read:user');
		expect(search.get('redirect_uri')).toBe(
			`${ORIGIN}/login/oauth/github/callback`
		);
	});

	it('keeps GitHub on a same-site callback', () => {
		expect(getOAuthProviderConfig('github')?.crossSiteCallback).toBe(false);
	});

	// Apple is the one provider that posts its callback cross-site, which
	// is what forces the login cookies to SameSite=None.
	it('asks Apple for a form_post response with an id token', () => {
		const { url, search } = authorizeUrlFor('apple', {
			APPLE_CLIENT_ID: 'com.example.ham.web',
		});

		expect(url.origin + url.pathname).toBe(
			'https://appleid.apple.com/auth/authorize'
		);
		expect(search.get('response_type')).toBe('code id_token');
		expect(search.get('response_mode')).toBe('form_post');
		expect(search.get('client_id')).toBe('com.example.ham.web');
		expect(search.get('scope')).toBe('name email');
		expect(search.get('redirect_uri')).toBe(
			`${ORIGIN}/login/oauth/apple/callback`
		);
	});

	it('marks Apple as a cross-site callback', () => {
		expect(getOAuthProviderConfig('apple')?.crossSiteCallback).toBe(true);
	});

	// SoruxGPT is an OpenID Connect provider, so the scope list is
	// space-separated and URLSearchParams encodes it as `+`.
	it('requests an authorization code from SoruxGPT', () => {
		const { url, search } = authorizeUrlFor('soruxgpt', {
			SORUXGPT_CLIENT_ID: 'soruxgpt-web-client',
		});

		expect(url.origin + url.pathname).toBe(
			'https://app.soruxgpt.com/oauth/authorize'
		);
		expect(search.get('response_type')).toBe('code');
		expect(search.get('client_id')).toBe('soruxgpt-web-client');
		expect(search.get('scope')).toBe('openid profile email');
		expect(search.get('state')).toBe('state-123');
	});

	it('sends the absolute callback url as the SoruxGPT redirect_uri', () => {
		const { search } = authorizeUrlFor('soruxgpt', {
			SORUXGPT_CLIENT_ID: 'soruxgpt-web-client',
		});

		expect(search.get('redirect_uri')).toBe(
			`${ORIGIN}/login/oauth/soruxgpt/callback`
		);
	});

	it('keeps SoruxGPT on a same-site callback', () => {
		expect(getOAuthProviderConfig('soruxgpt')?.crossSiteCallback).toBe(false);
	});

	it('URL-encodes the state it is given', () => {
		const config = getOAuthProviderConfig('github');
		if (!config) throw new Error('missing config');
		const search = new URL(
			config.buildAuthorizeUrl({
				callbackUrl: 'https://ham.example.com/login/oauth/github/callback',
				state: 'a b&c',
			})
		).searchParams;

		expect(search.get('state')).toBe('a b&c');
	});

	// Client ids are Worker vars injected per request. A provider left
	// unset must still build a URL — the upstream rejects it with a clear
	// error instead of the login page crashing on `undefined`.
	it('builds an URL with an empty client id when the var is unset', () => {
		const { search } = authorizeUrlFor('github', { GITHUB_CLIENT_ID: '' });

		expect(search.get('client_id')).toBe('');
		expect(search.get('redirect_uri')).toBe(
			`${ORIGIN}/login/oauth/github/callback`
		);
	});
});

describe('isOAuthProvider', () => {
	it('accepts every registered provider', () => {
		for (const id of OAUTH_PROVIDER_IDS) {
			expect(isOAuthProvider(id)).toBe(true);
		}
	});

	it('rejects unknown, empty and missing values', () => {
		expect(isOAuthProvider('google')).toBe(false);
		expect(isOAuthProvider('')).toBe(false);
		expect(isOAuthProvider(null)).toBe(false);
		expect(isOAuthProvider(undefined)).toBe(false);
	});

	it('rejects values that are not strings', () => {
		expect(isOAuthProvider(1 as unknown as string)).toBe(false);
	});
});

describe('getOAuthProviderConfig', () => {
	it('returns the config for a known provider', () => {
		expect(getOAuthProviderConfig('apple')?.id).toBe('apple');
	});

	// Callers use the null return to answer 404 on an unknown provider.
	it('returns null for an unknown provider', () => {
		expect(getOAuthProviderConfig('google')).toBeNull();
		expect(getOAuthProviderConfig(null)).toBeNull();
		expect(getOAuthProviderConfig(undefined)).toBeNull();
	});
});

describe('login URL builders', () => {
	it('builds the OAuth start href with an encoded destination', () => {
		expect(buildLoginOAuthStartHref('github', '/console')).toBe(
			'/login/oauth/github?from=%2Fconsole'
		);
	});

	it('encodes a destination that carries a query string', () => {
		const href = buildLoginOAuthStartHref(
			'qq',
			'/sso-authorize?client_id=app&state=s'
		);
		const url = new URL(href, 'https://placeholder.invalid');

		expect(url.pathname).toBe('/login/oauth/qq');
		// One decode round-trip has to give the whole destination back,
		// otherwise the authorize flow restarts without its client_id.
		expect(url.searchParams.get('from')).toBe(
			'/sso-authorize?client_id=app&state=s'
		);
	});

	it('builds the callback path', () => {
		expect(buildLoginOAuthCallbackPath('apple')).toBe(
			'/login/oauth/apple/callback'
		);
	});

	it('builds the absolute callback url from the origin', () => {
		expect(buildLoginOAuthCallbackUrl(ORIGIN, 'apple')).toBe(
			'https://ham.example.com/login/oauth/apple/callback'
		);
	});
});
