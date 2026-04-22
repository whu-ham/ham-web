# File Header: JSDoc Comment Required

Every source file that is created or modified **MUST** include a file-level JSDoc header at the very top:

```ts
/**
 * @author Claude
 * @version <version>
 * @date <YYYY/M/D HH:mm:ss>
 */
```

## Rules

- `@author` is always `Claude`.
- `@version` starts at `1.0` for new files and increments (e.g. `1.1`, `2.0`) for each modification.
- `@date` uses the **current local date and time** at the time of creation/modification, formatted as `YYYY/M/D HH:mm:ss` (e.g. `2026/4/20 19:17:52`).
- The header must appear **before** any `'use client'` / `'use server'` directives and imports.

## Enforcement

- AI agents (Claude Code, etc.) MUST add or update this header on every file they touch.
