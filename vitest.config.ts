/**
 * @author Claude
 * @version 2.0
 * @date 2026/9/26 12:20:00
 *
 * Vitest configuration for the ham-web unit-test suite.
 *
 * The Playwright suite under `e2e/` owns the browser-level coverage; this
 * config drives the unit tests that run in CI via `pnpm test:coverage`.
 */
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
		// Hooks and components are rendered for real, so the suite needs a
		// DOM. Server-side modules (route handlers, serverFetch) run fine on
		// jsdom too, and one environment keeps the mocking predictable.
		environment: 'jsdom',
		setupFiles: ['vitest.setup.ts'],
		// The e2e suite is driven by Playwright, not Vitest. Scoping the
		// glob to app code keeps Vitest from collecting
		// e2e/specs/*.spec.ts, whose `@playwright/test` import it cannot run.
		include: [
			'{app,components,hooks,services,store,i18n,mocks}/**/*.{test,spec}.{ts,tsx}',
		],
		exclude: ['node_modules/**', 'e2e/**'],
		coverage: {
			provider: 'v8',
			// Unit coverage is scoped to the modules that own logic: services,
			// hooks, stores, the BFF proxy / route handlers, and the plain
			// `.ts` helpers. Presentation lives in `.tsx` files (pages, views,
			// HeroUI components) and is exercised by the Playwright suite
			// instead, so counting it here would only measure how much of the
			// e2e flow a unit test happens to touch.
			include: [
				'app/**/*.ts',
				'components/**/*.ts',
				'hooks/**/*.ts',
				'i18n/**/*.ts',
				'services/**/*.ts',
				'store/**/*.ts',
			],
			exclude: [
				'**/*.{test,spec}.{ts,tsx}',
				'**/__tests__/**',
				'**/*.d.ts',
				'mocks/**',
			],
			// Every metric has to clear 90%. A suite that only asserts the
			// happy path leaves most branches unexercised, so branches are
			// held to the same bar as statements and lines.
			thresholds: {
				statements: 90,
				branches: 90,
				functions: 90,
				lines: 90,
			},
		},
	},
	define: {
		// Provide required env vars for modules that validate at import time
		'process.env.HAM_BACKEND_ORIGIN': '"http://localhost:8080"',
		'process.env.NODE_ENV': '"test"',
	},
});
