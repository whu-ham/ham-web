# AGENTS.md

This file provides guidance to [Codex](https://docs.Codex.com/Codex) (and other AI pair-programming agents) when working in this repository.

## Project Overview

`ham-web` is the web frontend for Ham (WHU). It is a [Next.js](https://nextjs.org/) 16 app written in TypeScript + React 19, styled with Tailwind CSS v4 and HeroUI, internationalised via `next-intl`, and deployed to Cloudflare Pages via OpenNext.

- Package manager: **pnpm** (see `pnpm-lock.yaml`, `.npmrc`)
- Framework: Next.js App Router (`app/`)
- Styling: Tailwind CSS v4 (`postcss.config.mjs`, `app/globals.css`)
- Linting: ESLint v9 flat config (`eslint.config.ts`) + Prettier (`.prettierrc`)
- i18n: `next-intl` with locale files in `messages/` (`en`, `zh`, `ja`) and config in `i18n/`

## Common Commands

Use `pnpm` for all scripts.

| Task                 | Command        |
| -------------------- | -------------- |
| Install dependencies | `pnpm install` |
| Start dev server     | `pnpm dev`     |
| Production build     | `pnpm build`   |
| Start built server   | `pnpm start`   |
| Cloudflare Pages build | `pnpm build:cf` |
| Lint                 | `pnpm lint`    |

## Repository Layout

```
app/          # Next.js App Router: routes, layouts and route-local files only
  sso-authorize/
  login/
  course-grade-stat/
components/   # Shared UI components (incl. theme config, language switcher)
services/     # API / service-layer code (auth, sso, ...)
hooks/        # Shared React hooks (useRequest, useUserInfo, ...)
i18n/         # next-intl runtime config
messages/     # Locale message catalogs (en / zh / ja)
public/       # Static assets
middleware.ts # Next.js middleware (locale / auth routing)
```

Import non-route code via the `@/` alias, e.g. `@/components/LanguageSwitcher`,
`@/services/auth`, `@/hooks/useRequest`. Keep `app/` reserved for Next.js route
segments — do not add cross-cutting code there.

## Mandatory Rules

All contributors — human or AI — MUST follow every rule under [`.Codex/rules/`](./.Codex/rules/). Key points:

1. **Always run `pnpm lint` and `pnpm build` before committing.** Do not commit if either fails.
2. **Commit messages MUST follow [Conventional Commits](https://www.conventionalcommits.org/).**
3. **All commit messages and code comments MUST be written in English.**

See [`.Codex/rules/`](./.Codex/rules/) for the full rule set:

- [`01-pre-commit.md`](./.Codex/rules/01-pre-commit.md)
- [`02-commit-style.md`](./.Codex/rules/02-commit-style.md)
- [`03-language.md`](./.Codex/rules/03-language.md)

## Notes for AI Agents

- Prefer editing existing files over creating new ones.
- Keep changes minimal and scoped to the user's request.
- When adding new UI strings, add entries to every file under `messages/` (`en.json`, `zh.json`, `ja.json`).
- Do not commit build artifacts (`.next/`, `out/`, `*.tsbuildinfo`) or local Codex state (see `.gitignore`).
