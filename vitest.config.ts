import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, '.'),
		},
	},
	define: {
		// Provide required env vars for modules that validate at import time
		'process.env.HAM_BACKEND_ORIGIN': '"http://localhost:8080"',
		'process.env.NODE_ENV': '"test"',
	},
});
