/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/15 01:02:15
 *
 * Unit tests for the browser OAuth provider registry.
 *
 * Covers the QQ flow in particular: it uses the authorization-code grant
 * so the backend can redeem the code with the Web app's own appkey, and
 * its callback URL must line up with the redirect_uri sent upstream.
 */

import { describe, expect, it, vi } from 'vitest';

import {
	buildLoginOAuthCallbackPath,
	buildLoginOAuthCallbackUrl,
	getOAuthProviderConfig,
	OAUTH_PROVIDER_IDS,
} from '@/services/oauth-providers';

const ORIGIN = 'https://ham.example.com';

const authorizeUrlFor = (provider: 'qq', env: Record<string, string>) => {
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
	it('registers qq, github and apple', () => {
		expect(OAUTH_PROVIDER_IDS).toEqual(['qq', 'github', 'apple']);
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
});
