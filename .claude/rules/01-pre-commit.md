# Pre-commit: Lint & Build

Before creating any commit, you **MUST** run and pass:

```bash
pnpm lint
pnpm build
```

- Do **not** commit code that fails `pnpm lint`.
- Do **not** commit code that fails `pnpm build`.
- If a lint error is auto-fixable, run `pnpm lint --fix` (or `eslint . --fix`) and re-verify.
- Commit only after both commands exit with status `0`.

## Enforcement

- CI runs `pnpm lint` (see `.github/workflows/lint.yml`); PRs failing lint will be rejected.
- Reviewers should reject any commit that violates this rule.
- AI agents (Claude Code, etc.) MUST refuse to produce commits or suggestions that violate this rule.
