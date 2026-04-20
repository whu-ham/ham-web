/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/20
 *
 * Central locale catalogue shared by the server runtime
 * (`i18n/request.ts`) and the client `LanguageSwitcher`. The list is
 * intentionally tiny — every entry here MUST have a matching
 * `messages/<code>.json` catalogue checked into the repo.
 *
 * Ham ships without a `[locale]` URL segment: the active language is
 * persisted in the `NEXT_LOCALE` cookie and the `?lang=` query
 * parameter, so no routing changes are required when a new language is
 * added. Simply append the code + label pair below, drop the matching
 * JSON catalogue under `messages/`, and the UI picks it up.
 */

export const LOCALES = ['zh', 'en', 'ja'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const LOCALE_QUERY_KEY = 'lang';

// The language names are intentionally written in their own language so
// that a Chinese speaker, an English speaker and a Japanese speaker can
// all recognise their own entry inside the language switcher without
// needing the rest of the UI to be translated first.
export const LOCALE_LABELS: Record<Locale, string> = {
	zh: '简体中文',
	en: 'English',
	ja: '日本語',
};

// Maps a locale code to the HTML `lang` attribute value. Keeping this
// separate from `LOCALES` lets us expose richer tags (e.g. `zh-CN`)
// without changing the translation key for everything else.
export const HTML_LANG: Record<Locale, string> = {
	zh: 'zh-CN',
	en: 'en',
	ja: 'ja',
};

export const isLocale = (value: string | undefined | null): value is Locale =>
	typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
