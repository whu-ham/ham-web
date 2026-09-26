/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:32:00
 *
 * Unit test for the inlined OG icon payload.
 *
 * The Open Graph image route runs on the Cloudflare Workers edge runtime,
 * where there is no filesystem to read a PNG from — the icon is therefore
 * inlined as a base64 data URL. A truncated or non-PNG payload silently
 * ships a broken link preview, so the test asserts the data-URL shape and
 * the PNG magic bytes rather than just "the export is a string".
 */
import { describe, expect, it } from 'vitest';

import { ICON_DATA_URL } from '@/app/sso-authorize/og-icon-b64';

const DATA_URL_PREFIX = 'data:image/png;base64,';

describe('ICON_DATA_URL', () => {
	it('is a base64 PNG data URL the OG route can inline at the edge', () => {
		expect(ICON_DATA_URL.startsWith(DATA_URL_PREFIX)).toBe(true);

		const payload = ICON_DATA_URL.slice(DATA_URL_PREFIX.length);
		expect(payload).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);

		const bytes = atob(payload);
		expect(bytes.charCodeAt(0)).toBe(0x89);
		expect(bytes.slice(1, 4)).toBe('PNG');
		expect(bytes.length).toBeGreaterThan(1000);
	});
});
