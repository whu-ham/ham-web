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
	{
		settings: {
			react: {
				version: '19.0',
			},
		},
	},
	reactPlugin.configs.flat['jsx-runtime'],
	reactHooks.configs.flat.recommended,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': 'error',
			'react/self-closing-comp': [
				'error',
				{
					component: true,
					html: true,
				},
			],
			'no-console': ['error', { allow: ['warn', 'error'] }],
			'func-style': ['error', 'expression', { allowArrowFunctions: true }],
		},
	},
	{
		// The e2e suite never renders React. Playwright fixtures take a
		// `use` callback, which the hooks plugin misreads as a hook call
		// inside a non-component function.
		files: ['e2e/**/*.ts', 'playwright.config.ts'],
		rules: {
			'react-hooks/rules-of-hooks': 'off',
		},
	},
	globalIgnores(['out/*', '.next/*', '.*/']),
	eslintPluginPrettierRecommended,
]);
