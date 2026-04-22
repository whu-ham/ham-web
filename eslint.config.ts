import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
	...nextVitals,
	...nextTs,
	reactPlugin.configs.flat.recommended,
	reactPlugin.configs.flat['jsx-runtime'],
	reactHooks.configs.flat.recommended,
	{
		rules: {
			'react/self-closing-comp': [
				'error',
				{
					component: true,
					html: true,
				},
			],
			'no-console': ['error', { allow: ['warn', 'error'] }],
		},
	},
	globalIgnores(['out/*', '.next/*', '.*/']),
	eslintPluginPrettierRecommended,
]);
