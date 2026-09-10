---
name: ham-web
description: Conventions for contributing to ham-web (WHU SSO + academic toolkit frontend). Use when writing, reviewing, or committing code in this repo so changes follow the pre-commit, commit-style, English-only, and file-header rules.
---

# ham-web Agent

You are working in `ham-web`, the web frontend for Ham (WHU) — a [Next.js](https://nextjs.org/) 16 App Router app in TypeScript + React 19, styled with Tailwind CSS v4 and HeroUI, internationalised via `next-intl`, and deployed to Cloudflare Pages via OpenNext.

Everything in this file is a hard requirement. If a request conflicts with a rule below, say so instead of silently violating the rule.

## Tooling

Package manager is **pnpm**. Never use `npm` or `yarn`.

| Task                   | Command        |
| ---------------------- | -------------- |
| Install dependencies   | `pnpm install` |
| Start dev server       | `pnpm dev`     |
| Production build       | `pnpm build`   |
| Start built server     | `pnpm start`   |
| Cloudflare Pages build | `pnpm build:cf` |
| Lint                   | `pnpm lint`    |
| Auto-fix lint          | `pnpm lint:fix` |
| Typecheck              | `pnpm typecheck` |
| Unit tests             | `pnpm test`    |
| E2E tests              | `pnpm test:e2e` |

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

## Rules

### 1. Pre-commit: Lint and Build

Before creating any commit, you **MUST** run and pass:

```bash
pnpm lint
pnpm build
```

- Do **not** commit code that fails `pnpm lint`.
- Do **not** commit code that fails `pnpm build`.
- If a lint error is auto-fixable, run `pnpm lint --fix` (or `eslint . --fix`) and re-verify.
- Commit only after both commands exit with status `0`.

CI runs `pnpm lint` (see `.github/workflows/lint.yml`); PRs failing lint are rejected. You MUST refuse to produce commits or suggestions that violate this rule.

### 2. Commit Style: Conventional Commits

All commit messages **MUST** follow the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer(s)>
```

Allowed `type` values:

| Type       | Purpose                                                        |
| ---------- | -------------------------------------------------------------- |
| `feat`     | A new feature                                                  |
| `fix`      | A bug fix                                                      |
| `docs`     | Documentation-only changes                                     |
| `style`    | Formatting, whitespace, semicolons — no code behavior change   |
| `refactor` | Code change that neither fixes a bug nor adds a feature        |
| `perf`     | Performance improvement                                        |
| `test`     | Adding or updating tests                                       |
| `build`    | Build system or external dependency changes (pnpm, next, etc.) |
| `ci`       | CI configuration changes (`.github/workflows/*`)               |
| `chore`    | Other changes that don't modify `src` or test files            |
| `revert`   | Reverts a previous commit                                      |

- Use the imperative mood in the subject ("add", not "added" / "adds").
- Keep the subject line ≤ 72 characters; do **not** end with a period.
- Use `!` after the type/scope or a `BREAKING CHANGE:` footer for breaking changes.
- Scope is optional but recommended (e.g. `feat(login): ...`, `fix(sso-authorize): ...`).

Examples:

```
feat(login): add passkey login tab
fix(i18n): correct Japanese translation for consent view
refactor(component): extract theme config into dedicated module
chore(deps): bump next to 16.1.4
feat(api)!: drop legacy auth endpoint
```

You MUST refuse to produce commit messages that violate this rule.

### 3. Language: English Only

All of the following **MUST** be written in English:

- Commit messages (subject, body, footers).
- Code comments (`//`, `/* */`, JSDoc/TSDoc).
- Identifiers (variable, function, class, file names).
- PR / MR titles and descriptions.

User-facing strings are exempt and should live in `messages/*.json` (i18n).

You MUST refuse to produce output that violates this rule.

### 4. File Header: JSDoc Comment Required

Every source file that is created or modified **MUST** include a file-level JSDoc header at the very top:

```ts
/**
 * @author Claude
 * @version <version>
 * @date <YYYY/M/D HH:mm:ss>
 */
```

- `@author` is always `Claude`.
- `@version` starts at `1.0` for new files and increments (e.g. `1.1`, `2.0`) for each modification.
- `@date` uses the **current local date and time** at the time of creation/modification, formatted as `YYYY/M/D HH:mm:ss` (e.g. `2026/4/20 19:17:52`).
- The header must appear **before** any `'use client'` / `'use server'` directives and imports.

You MUST add or update this header on every file you touch.

## Working Style

- Prefer editing existing files over creating new ones.
- Keep changes minimal and scoped to the request.
- When adding new UI strings, add entries to every file under `messages/` (`en.json`, `zh.json`, `ja.json`).
- Do not commit build artifacts (`.next/`, `out/`, `*.tsbuildinfo`) or local Claude state (see `.gitignore`).
