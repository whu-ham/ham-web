# Ham for Web

[![Build](https://github.com/whu-ham/ham-web/actions/workflows/build.yml/badge.svg)](https://github.com/whu-ham/ham-web/actions/workflows/build.yml)
[![Unit Tests](https://github.com/whu-ham/ham-web/actions/workflows/test.yml/badge.svg)](https://github.com/whu-ham/ham-web/actions/workflows/test.yml)
[![E2E Tests](https://github.com/whu-ham/ham-web/actions/workflows/e2e.yml/badge.svg)](https://github.com/whu-ham/ham-web/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/gh/whu-ham/ham-web/graph/badge.svg?token=LOXQJAE6PO)](https://codecov.io/gh/whu-ham/ham-web)
[![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/whu-ham/ham-web)

Web frontend for **Ham** (WHU) — an SSO + academic toolkit companion to the Ham mobile app.

> 🚧 Still work in progress.

User documentation: [https://orangeboychen.github.io/whu-ham/](https://orangeboychen.github.io/whu-ham/)

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 16 (App Router) + React 19 + TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [HeroUI v3](https://heroui.com/)
- **State**: [Jotai](https://jotai.org/)
- **i18n**: [`next-intl`](https://next-intl.dev/) with catalogues under [`messages/`](./messages) (`zh` / `en` / `ja`)
- **Tooling**: ESLint v9 (flat config), Prettier, pnpm

## Getting Started

Requires **Node.js 20+** and **pnpm**.

```bash
# Install dependencies
pnpm install

# Start the dev server (Turbopack)
pnpm dev

# Production build
pnpm build
pnpm start

# Cloudflare Pages build
pnpm build:cf

# Lint
pnpm lint

# Unit tests (Vitest)
pnpm test

# End-to-end tests (Playwright)
pnpm test:e2e
```

Dev server runs at [http://localhost:3000](http://localhost:3000).

## Repository Layout

```
app/                  # Next.js App Router pages & components
  lib/auth.ts         # Server-side auth helpers (fetchMe, requireAuth, processAppCallback)
  console/            # Authenticated console (API key management)
    tokens/           # Token CRUD pages
  login/              # Standalone login page
    callback/         # OAuth2 app-callback (code → session)
  sso-authorize/      # SSO consent + deep-link handoff
  api/                # BFF route handlers (proxy to backend)
components/           # Shared UI components (theme, language switcher, header bar, …)
hooks/                # Shared React hooks
services/             # Service layer
  shared.ts           # Client-side HTTP infrastructure (ApiError, request<T>)
  server-fetch.ts     # Server-side fetch (cookie forwarding, Set-Cookie relay)
  redirect.ts         # Safe redirect URL validation
  sso/                # SSO client API (WebAuthApi), deep-link builder, UA detection
  token/              # Token client API & server-side data fetching
store/                # Global Jotai atoms
i18n/                 # next-intl runtime config
messages/             # Locale message catalogues (en / zh / ja)
mocks/                # MSW mock handlers & data (dev only)
e2e/                  # Playwright end-to-end suite
  stub/               # Backend stub the app is pointed at during e2e runs
  fixtures/           # Session-cookie fixtures and shared seed data
  pages/              # Page objects
  specs/              # Test specs, one per screen or flow
public/               # Static assets
middleware.ts         # Locale + auth routing middleware
```

## Features

- [x] SSO authorisation flow (consent view, QR login, deep-link to native app)
- [x] Passkey (WebAuthn) login
- [x] Mobile app login (deep-link → OAuth2 code callback)
- [x] API key management (create, rotate, revoke)
- [x] SSR auth guard (`requireAuth`) with redirect-back support
- [x] Dark / light / system theme switcher
- [x] Multi-language UI (`zh` / `en` / `ja`) with cookie persistence
- [x] Mobile H5 fallback (install prompt + Passkey option)
- [ ] Third-party login
- [ ] Course grade lookup
- [ ] Course detail lookup
- [ ] Course selection panel

## Testing

- **Unit** (`pnpm test`) — Vitest, for pure logic and hooks.
- **E2E** (`pnpm test:e2e`) — Playwright, driving the production build in a
  real browser.

The e2e suite points `HAM_BACKEND_ORIGIN` at the stub server in `e2e/stub`,
which stands in for the real backend. A stub is used rather than MSW because
Server Components call the backend directly (`/web/**`) and never touch
`/api/**`, so a browser-side service worker cannot intercept them. The stub
exposes `/__stub/**` control endpoints so specs can seed data and inject
failures; `setupStub()` resets and patches that state in one atomic call.

Browser binaries are installed separately:

```bash
pnpm exec playwright install --with-deps chromium
```

## Contributing

All contributors — human or AI — MUST follow the rules under [`.claude/rules/`](./.claude/rules/):

1. **Pre-commit**: `pnpm lint` and `pnpm build` must both pass — see [`01-pre-commit.md`](./.claude/rules/01-pre-commit.md).
2. **Commit style**: [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) — see [`02-commit-style.md`](./.claude/rules/02-commit-style.md).
3. **Language**: commit messages, identifiers, and code comments must be in English — see [`03-language.md`](./.claude/rules/03-language.md). User-facing strings go through `messages/*.json`.

AI pair-programming agents should additionally read [`CLAUDE.md`](./CLAUDE.md).

## License

ham-web is [MIT licensed](./LICENSE).
