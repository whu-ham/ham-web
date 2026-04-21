/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/21 20:18:24
 */
import type { OpenNextConfig } from '@opennextjs/cloudflare';

const config: OpenNextConfig = {
	default: {
		override: {
			wrapper: 'cloudflare-node',
			converter: 'edge',
			incrementalCache: 'dummy',
			tagCache: 'dummy',
			queue: 'dummy',
		},
	},
	middleware: {
		external: true,
		override: {
			wrapper: 'cloudflare-edge',
			converter: 'edge',
			proxyExternalRequest: 'fetch',
		},
	},
};

export default config;
