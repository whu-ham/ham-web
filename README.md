# Ham for Web

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

## Contributing

All contributors — human or AI — MUST follow the rules under [`.claude/rules/`](./.claude/rules/):

1. **Pre-commit**: `pnpm lint` and `pnpm build` must both pass — see [`01-pre-commit.md`](./.claude/rules/01-pre-commit.md).
2. **Commit style**: [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) — see [`02-commit-style.md`](./.claude/rules/02-commit-style.md).
3. **Language**: commit messages, identifiers, and code comments must be in English — see [`03-language.md`](./.claude/rules/03-language.md). User-facing strings go through `messages/*.json`.

AI pair-programming agents should additionally read [`CLAUDE.md`](./CLAUDE.md).

## License

ham-web is [MIT licensed](./LICENSE).
