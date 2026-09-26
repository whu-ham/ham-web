/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:28:00
 *
 * Unit tests for the next-intl request config.
 *
 * Every server render resolves its locale here, and the resolution is the
 * only thing standing between a visitor and a page in a language they cannot
 * read: the cookie is an explicit pick (and must win), `Accept-Language` is a
 * negotiation with q-weights, and the default is the last resort. A wrong
 * pick also ships the wrong message catalogue, so each case asserts on the
 * catalogue that came back, not just on the locale code.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// `next/headers` is the only boundary: the module under test otherwise runs
// exactly as it does inside a server render.
const { request } = vi.hoisted(() => ({
	request: {
		cookie: undefined as string | undefined,
		acceptLanguage: null as string | null,
	},
}));

vi.mock('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) =>
			request.cookie === undefined
				? undefined
				: { name, value: request.cookie },
	}),
	headers: async () => ({
		get: (name: string) =>
			name === 'accept-language' ? request.acceptLanguage : null,
	}),
}));

// jsdom resolves `next-intl/server` to its Client Components build, which
// throws on `getRequestConfig` instead of returning the callback. Upstream
// it is a pass-through (`(config) => config`), so standing it in with the
// identity keeps the config under test in the real server shape.
vi.mock('next-intl/server', () => ({
	getRequestConfig: (createRequestConfig: unknown) => createRequestConfig,
}));

import { DEFAULT_LOCALE, LOCALE_COOKIE, Locale, LOCALES } from '@/i18n/config';
import getRequestConfig, {
	LOCALES as RE_EXPORTED_LOCALES,
} from '@/i18n/request';

/**
 * What the callback hands back. `next-intl` types both members as optional
 * because a config may omit them; this callback always fills them in, so
 * the tests narrow the type instead of guarding on every read.
 */
interface ResolvedConfig {
	locale: Locale;
	messages: { language: { switcher: { auto: string } } } & Record<
		string,
		unknown
	>;
}

const resolve = async () =>
	(await getRequestConfig({
		requestLocale: Promise.resolve(undefined),
	})) as unknown as ResolvedConfig;

describe('i18n/request', () => {
	beforeEach(() => {
		request.cookie = undefined;
		request.acceptLanguage = null;
	});

	it('exposes the locale catalogue for callers that only need the list', () => {
		expect(RE_EXPORTED_LOCALES).toEqual(LOCALES);
		expect(RE_EXPORTED_LOCALES).toEqual(['zh', 'en', 'ja']);
	});

	it('honours an explicit pick over the browser negotiation', async () => {
		request.cookie = 'ja';
		request.acceptLanguage = 'en-US,en;q=0.9';

		const config = await resolve();

		expect(config.locale).toBe('ja');
		expect(config.messages.language.switcher.auto satisfies string).toBe(
			'ブラウザに従う'
		);
	});

	it('ignores a cookie holding a language we do not ship', async () => {
		request.cookie = 'klingon';
		request.acceptLanguage = 'en-GB';

		const config = await resolve();

		expect(config.locale).toBe('en');
		expect(config.messages.language.switcher.auto).toBe('Follow browser');
	});

	it('ignores an empty cookie value', async () => {
		request.cookie = '';
		request.acceptLanguage = 'ja-JP';

		const config = await resolve();

		expect(config.locale).toBe('ja');
	});

	it('orders the negotiation by q-weight', async () => {
		// `fr-FR` outranks everything but is not shipped, so the highest
		// ranked supported tag must win — not the first one listed.
		request.acceptLanguage = 'fr-FR,zh-HK;q=0.9,ja-JP;q=0.8';

		const config = await resolve();

		expect(config.locale).toBe('zh');
		expect(config.messages.language.switcher.auto).toBe('跟随浏览器');
	});

	it('matches a bare tag before falling back to a subtag', async () => {
		request.acceptLanguage = 'en';

		const config = await resolve();

		expect(config.locale).toBe('en');
	});

	it('treats an unparseable q-weight as zero', async () => {
		// `q=abc` must not outrank a real weight by becoming `NaN` in the
		// sort comparator, which would leave the order undefined.
		request.acceptLanguage = 'fr;q=abc, ja;q=0';

		const config = await resolve();

		expect(config.locale).toBe('ja');
	});

	it('falls back to the default when nothing can be negotiated', async () => {
		request.acceptLanguage = 'fr-FR,de;q=0.8';

		const config = await resolve();

		expect(config.locale).toBe(DEFAULT_LOCALE);
		expect(config.messages.language.switcher.auto).toBe('跟随浏览器');
	});

	it('falls back to the default when the client sends no header', async () => {
		const config = await resolve();

		expect(config.locale).toBe('zh');
		expect(Object.keys(config.messages).length).toBeGreaterThan(0);
	});

	it('reads the locale from the cookie name the switcher writes', () => {
		// The switcher and the server have to agree on this name or a pick
		// is stored somewhere the next request never looks.
		expect(LOCALE_COOKIE).toBe('NEXT_LOCALE');
	});
});
