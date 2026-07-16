import type { OAuthProvider } from '@/services/oauth-providers';

export type OAuthProviderButtonKind = 'circle' | 'image';

export interface OAuthProviderButtonVisualConfig {
	button: {
		backgroundColor: string | null;
		darkBackgroundColor: string | null;
		kind: OAuthProviderButtonKind;
	};
	icon: {
		darkSrc: string | null;
		src: string;
	};
	provider: OAuthProvider;
}

export const OAUTH_PROVIDER_BUTTON_CONFIGS: readonly OAuthProviderButtonVisualConfig[] =
	[
		{
			button: {
				backgroundColor: '#12B7F5',
				darkBackgroundColor: null,
				kind: 'circle',
			},
			icon: {
				darkSrc: null,
				src: '/login/login_qq.png',
			},
			provider: 'qq',
		},
		{
			button: {
				backgroundColor: null,
				darkBackgroundColor: null,
				kind: 'image',
			},
			icon: {
				darkSrc: '/login/login_github_light.png',
				src: '/login/login_github.png',
			},
			provider: 'github',
		},
		{
			button: {
				backgroundColor: '#111111',
				darkBackgroundColor: '#FFFFFF',
				kind: 'circle',
			},
			icon: {
				darkSrc: '/login/login_apple_dark.png',
				src: '/login/login_apple_light.png',
			},
			provider: 'apple',
		},
	];
