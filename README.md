# Ham for Web

[![Build](https://github.com/whu-ham/ham-web/actions/workflows/build.yml/badge.svg)](https://github.com/whu-ham/ham-web/actions/workflows/build.yml)
[![Unit Tests](https://github.com/whu-ham/ham-web/actions/workflows/test.yml/badge.svg)](https://github.com/whu-ham/ham-web/actions/workflows/test.yml)
[![E2E Tests](https://github.com/whu-ham/ham-web/actions/workflows/e2e.yml/badge.svg)](https://github.com/whu-ham/ham-web/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/gh/whu-ham/ham-web/graph/badge.svg?token=LOXQJAE6PO)](https://codecov.io/gh/whu-ham/ham-web)
[![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/whu-ham/ham-web)

Web frontend for **Ham** (WHU) — an SSO + academic toolkit companion to the Ham mobile app.

> 🚧 Still work in progress.

User documentation: [https://docs.ham.nowcent.cn](https://docs.ham.nowcent.cn)

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
pnpm lint:fix        # auto-fix what can be fixed

# Formatting
pnpm format          # write
pnpm format:check    # verify

# Type checking
pnpm typecheck       # app + e2e

# Unit tests (Vitest)
pnpm test

# End-to-end tests (Playwright)
pnpm test:e2e
```

Dev server runs at [http://localhost:3000](http://localhost:3000).

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

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

ham-web is [MIT licensed](./LICENSE).
