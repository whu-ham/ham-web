# Commit Style: Conventional Commits

All commit messages **MUST** follow the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

Format:

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

Rules:

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

## Enforcement

- Reviewers should reject any commit whose message violates this specification.
- AI agents (Claude Code, etc.) MUST refuse to produce commit messages that violate this rule.
