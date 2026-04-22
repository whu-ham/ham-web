/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/20
 *
 * Central theme catalogue shared by the `ThemeSwitcher` component and
 * any surrounding code that needs to read/write the user's theme
 * preference. We intentionally mirror the shape of `i18n/config.ts`
 * so both switchers behave identically:
 *
 *   - A concrete preference (`light` | `dark`) is persisted in the
 *     `NEXT_THEME` cookie + localStorage.
 *   - The absence of the cookie means "follow system", i.e. the
 *     client resolves the active theme from the CSS
 *     `prefers-color-scheme` media query at runtime.
 *
 * HeroUI v3 (see https://heroui.com/docs/react/getting-started/colors)
 * toggles palettes via either `class="dark"` or `data-theme="dark"`
 * on the `<html>` element. We write both so downstream CSS — whether
 * it targets Tailwind's `dark:` variant or HeroUI's
 * `[data-theme="dark"]` selector — picks up the change without
 * additional wiring.
 */

export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = 'NEXT_THEME';

// Key on `<html>` used by the inline bootstrap script to avoid a
// flash of incorrect theme on first paint. Keeping it named is
// cheaper than maintaining a separate DOM attribute.
export const THEME_CLASSES: Record<Theme, string> = {
	light: 'light',
	dark: 'dark',
};

export const isTheme = (value: string | undefined | null): value is Theme =>
	typeof value === 'string' && (THEMES as readonly string[]).includes(value);

/**
 * Theme used when we can't infer a better one on the server (no cookie
 * yet, or the cookie value is malformed). The inline bootstrap script
 * below will still correct this on the client before the first paint
 * if the user's system is in dark mode, so the only visible effect of
 * this default is for first-time visitors with a light-themed OS.
 */
export const DEFAULT_SERVER_THEME: Theme = 'light';

/**
 * Inline script executed in `<head>` BEFORE the body is parsed. It
 * reconciles `<html>`'s theme classes with the user's preference
 * (cookie → localStorage → `prefers-color-scheme`) so the first paint
 * never flashes the wrong palette.
 *
 * Kept deliberately tiny and dependency-free — it is injected via
 * `dangerouslySetInnerHTML` and runs synchronously on every page
 * load, so any bloat here shows up on the critical path.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  try {
    var COOKIE = '${THEME_COOKIE}';
    var doc = document.documentElement;
    var cookie = document.cookie.split('; ').find(function (c) {
      return c.indexOf(COOKIE + '=') === 0;
    });
    var override = cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
    if (override !== 'light' && override !== 'dark') {
      try {
        var ls = window.localStorage.getItem(COOKIE);
        if (ls === 'light' || ls === 'dark') override = ls;
      } catch (_) {}
    }
    var resolved = override;
    if (resolved !== 'light' && resolved !== 'dark') {
      resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    var other = resolved === 'dark' ? 'light' : 'dark';
    doc.classList.remove(other);
    doc.classList.add(resolved);
    doc.setAttribute('data-theme', resolved);
    doc.style.colorScheme = resolved;
  } catch (_) {
    /* Swallow — a broken bootstrap must never block the page. */
  }
})();`;
