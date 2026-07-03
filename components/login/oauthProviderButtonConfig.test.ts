import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OAUTH_PROVIDER_BUTTON_CONFIGS } from '@/components/login/oauthProviderButtonConfig';

const getProviderConfig = (provider: string) =>
	OAUTH_PROVIDER_BUTTON_CONFIGS.find((config) => config.provider === provider);

const loginAssetsDir = join(process.cwd(), 'public', 'login');

const collectAssetPaths = () =>
	OAUTH_PROVIDER_BUTTON_CONFIGS.flatMap(({ icon }) =>
		[icon.src, icon.darkSrc].filter(
			(assetPath): assetPath is string => assetPath !== null
		)
	);

describe('oauthProviderButtonConfig', () => {
	it('keeps QQ and Apple on circular buttons with themed colors', () => {
		expect(getProviderConfig('qq')).toMatchObject({
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
		});
		expect(getProviderConfig('apple')).toMatchObject({
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
		});
	});

	it('keeps GitHub as the image-only provider', () => {
		expect(getProviderConfig('github')).toMatchObject({
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
		});
	});

	it('stores the correct dark assets', () => {
		const github = getProviderConfig('github');
		const apple = getProviderConfig('apple');
		const qq = getProviderConfig('qq');

		expect(github?.icon.darkSrc).toBe('/login/login_github_light.png');
		expect(apple?.icon.darkSrc).toBe('/login/login_apple_dark.png');
		expect(qq?.icon.darkSrc).toBeNull();
	});

	it('references existing files under public/login', () => {
		for (const assetPath of collectAssetPaths()) {
			const relativePath = assetPath.replace(/^\/login\//, '');
			expect(existsSync(join(loginAssetsDir, relativePath))).toBe(true);
		}
	});
});
