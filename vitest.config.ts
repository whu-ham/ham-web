import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, '.'),
		},
	},
	// Vitest 5 nests test options under `test`.
	test: {
		// The e2e suite is driven by Playwright, not Vitest. Scoping the
		// glob to app code keeps Vitest from collecting
		// e2e/specs/*.spec.ts, whose `@playwright/test` import it cannot run.
		include: [
			'{app,components,hooks,services,store,i18n,mocks}/**/*.{test,spec}.{ts,tsx}',
		],
		exclude: ['node_modules/**', 'e2e/**'],
	},
	define: {
		// Provide required env vars for modules that validate at import time
		'process.env.HAM_BACKEND_ORIGIN': '"http://localhost:8080"',
		'process.env.NODE_ENV': '"test"',
	},
});
