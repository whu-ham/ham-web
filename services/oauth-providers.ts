export const OAUTH_PROVIDER_IDS = ['qq', 'github', 'apple'] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDER_IDS)[number];

export interface OAuthProviderConfig {
	id: OAuthProvider;
	accentClassName: string;
	buildAuthorizeUrl: (params: { callbackUrl: string; state: string }) => string;
}

const getPublicEnv = (name: string): string => process.env[name] ?? '';

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
		buildAuthorizeUrl: ({ callbackUrl, state }) => {
			const query = buildCallbackQuery({
				client_id: getPublicEnv('NEXT_PUBLIC_QQ_CLIENT_ID'),
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
		buildAuthorizeUrl: ({ callbackUrl, state }) => {
			const query = buildCallbackQuery({
				client_id: getPublicEnv('NEXT_PUBLIC_GITHUB_CLIENT_ID'),
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
		buildAuthorizeUrl: ({ callbackUrl, state }) => {
			const query = buildCallbackQuery({
				client_id: getPublicEnv('NEXT_PUBLIC_APPLE_CLIENT_ID'),
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
