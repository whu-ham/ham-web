/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/11 00:41:35
 *
 * Browser OAuth provider registry.
 *
 * Holds the endpoint and scope details for each supported provider plus
 * the URL builders for the web login entry and callback paths. Client
 * ids are read from the Cloudflare Worker environment at request time,
 * so they are deliberately not `NEXT_PUBLIC_*` — that prefix would
 * inline them into the browser bundle. A provider left unset still
 * routes; the upstream authorization request just fails there.
 */

export const OAUTH_PROVIDER_IDS = ['qq', 'github', 'apple'] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDER_IDS)[number];

export interface OAuthProviderConfig {
	id: OAuthProvider;
	accentClassName: string;
	buildAuthorizeUrl: (params: { callbackUrl: string; state: string }) => string;
	/**
	 * Whether the provider POSTs its callback cross-site. Only Apple does:
	 * `response_mode=form_post` makes appleid.apple.com the initiator of a
	 * POST to us, and browsers withhold `SameSite=Lax` cookies from that.
	 * The caller uses this to relax the login cookies to `SameSite=None`.
	 */
	crossSiteCallback: boolean;
}

// Client ids arrive as Worker vars (see `vars` in wrangler.jsonc) and are
// copied onto `process.env` per request by the OpenNext runtime shim, so
// this must stay a dynamic lookup — a literal `process.env.QQ_CLIENT_ID`
// would be statically inlined (as `undefined`) at build time.
const getWorkerEnv = (name: string): string => process.env[name] ?? '';

const buildCallbackQuery = (params: Record<string, string>) => {
	const search = new URLSearchParams(params);
	return search.toString();
};

export const OAUTH_PROVIDER_CONFIGS: Record<
	OAuthProvider,
	OAuthProviderConfig
> = {
	qq: {
		id: 'qq',
		accentClassName: 'bg-[#12B7F5]',
		crossSiteCallback: false,
		buildAuthorizeUrl: ({ callbackUrl, state }) => {
			const query = buildCallbackQuery({
				client_id: getWorkerEnv('QQ_CLIENT_ID'),
				redirect_uri: callbackUrl,
				response_type: 'token',
				scope: 'get_user_info',
				state,
			});
			return `https://graph.qq.com/oauth2.0/authorize?${query}`;
		},
	},
	github: {
		id: 'github',
		accentClassName: 'bg-[#24292F]',
		crossSiteCallback: false,
		buildAuthorizeUrl: ({ callbackUrl, state }) => {
			const query = buildCallbackQuery({
				client_id: getWorkerEnv('GITHUB_CLIENT_ID'),
				redirect_uri: callbackUrl,
				scope: 'read:user',
				state,
			});
			return `https://github.com/login/oauth/authorize?${query}`;
		},
	},
	apple: {
		id: 'apple',
		accentClassName: 'bg-[#111111]',
		crossSiteCallback: true,
		buildAuthorizeUrl: ({ callbackUrl, state }) => {
			const query = buildCallbackQuery({
				client_id: getWorkerEnv('APPLE_CLIENT_ID'),
				redirect_uri: callbackUrl,
				response_mode: 'form_post',
				response_type: 'code id_token',
				scope: 'name email',
				state,
			});
			return `https://appleid.apple.com/auth/authorize?${query}`;
		},
	},
};

export const isOAuthProvider = (
	value: string | null | undefined
): value is OAuthProvider =>
	typeof value === 'string' &&
	OAUTH_PROVIDER_IDS.includes(value as OAuthProvider);

export const getOAuthProviderConfig = (
	provider: string | null | undefined
): OAuthProviderConfig | null =>
	isOAuthProvider(provider) ? OAUTH_PROVIDER_CONFIGS[provider] : null;

export const buildLoginOAuthStartHref = (
	provider: OAuthProvider,
	from: string
): string => `/login/oauth/${provider}?from=${encodeURIComponent(from)}`;

export const buildLoginOAuthCallbackPath = (provider: OAuthProvider): string =>
	`/login/oauth/${provider}/callback`;
