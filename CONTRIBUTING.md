# Contributing to ham-web

Thanks for taking the time to contribute. This page covers what every
contributor — human or AI — MUST follow. For a project overview, the
command reference, and the repository layout, start with
[`AGENTS.md`](./AGENTS.md).

## Mandatory Rules

All contributions MUST follow the rules defined in the
[`ham-web` agent](./.agents/ham-web.md):

1. **Pre-commit**: `pnpm lint` and `pnpm build` must both pass. Do not
   commit if either fails — see [Pre-commit: Lint and Build](./.agents/ham-web.md#1-pre-commit-lint-and-build).
2. **Commit style**: [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
   — see [Commit Style: Conventional Commits](./.agents/ham-web.md#2-commit-style-conventional-commits).
3. **Language**: commit messages, identifiers, and code comments must be in
   English. User-facing strings are exempt and go through `messages/*.json`
   — see [Language: English Only](./.agents/ham-web.md#3-language-english-only).
4. **File header**: every source file you create or modify needs a file-level
   JSDoc header — see [File Header: JSDoc Comment Required](./.agents/ham-web.md#4-file-header-jsdoc-comment-required).

The agent file is the single source of truth for these rules — read it before
writing or committing any code.

## Before You Open a Pull Request

```bash
pnpm lint            # ESLint (also runs Prettier on .ts/.tsx)
pnpm format:check    # covers file types ESLint does not lint
pnpm typecheck       # app + e2e
pnpm build           # production build must succeed
pnpm test            # Vitest unit tests
pnpm test:e2e        # Playwright, drives the production build
```

CI runs `pnpm lint` and `pnpm format:check` on every pull request (see
[`.github/workflows/lint.yml`](./.github/workflows/lint.yml)); PRs failing
lint are rejected. See the [Testing section of the README](./README.md#testing)
for details on the e2e suite and how to install browser binaries.

## Keeping the Agent Instruction Files in Sync

`.claude/agents/ham-web.md` is a hard link to `.agents/ham-web.md`, and
`CLAUDE.md` is a hard link to `AGENTS.md`, so in a checkout that has them the
pairs cannot drift apart.

Note that git stores file content, not hard link relationships: a fresh clone
materialises each path as its own independent file. Keep the mirrors in sync
when editing, or re-create the links locally:

```bash
ln .agents/ham-web.md .claude/agents/ham-web.md
ln AGENTS.md CLAUDE.md
```

## For AI Pair-Programming Agents

AI coding agents should additionally read [`AGENTS.md`](./AGENTS.md) and the
[`ham-web` agent](./.agents/ham-web.md) before making changes.
