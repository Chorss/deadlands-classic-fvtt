---
name: verify-system
description: Full system sanity check — manifest, EN/PL parity, CSS coverage, i18n keys, unit tests. Runs the same two commands as CI and the pre-commit hook.
allowed-tools: Bash(npm run lint), Bash(npm run lint:*), Bash(npm run verify:all), Bash(npm test), Bash(node:*)
---

# Verify the system

One definition of "green", shared by CI (`.github/workflows/ci.yml`), the
`.githooks/pre-commit` hook, and this skill. If these two commands pass, the
repository is green — there is no third checklist to remember.

## Procedure

Run both, in order. Stop at the first failure.

```bash
npm run lint        # Biome — formatting + lint rules
npm run verify:all  # manifest + EN/PL parity → CSS coverage → i18n keys → unit tests
```

`verify:all` chains four checks with `&&`, so it stops at the first one that
fails and its exit code is the failing check's:

| Step | Command | Catches |
|---|---|---|
| 1 | `node tools/verify-documenttypes.mjs` | `system.json` `documentTypes` drift, EN/PL key parity |
| 2 | `node tools/audit-css.mjs` | `dlc-*` classes used in `.hbs` with no rule in `styles/` |
| 3 | `node tools/audit-i18n.mjs` | `DEADLANDS.*` keys referenced in code/templates but missing from `lang/` |
| 4 | `npm test` | `node:test` unit tests for pure core logic |

## Reporting

Reply in Polish, in **one paragraph**. Do not dump command output — surface only
failures and their `file:line`.

- Success → `verify-system OK` plus the test count.
- Failure → `verify-system FAILED: <short reason>`, naming the failing step from
  the table above and the offending file path.

## When a step fails

- **Step 1** — a `documentTypes` entry or a `lang/en.json` ↔ `lang/pl.json` key is missing. Key sets MUST match.
- **Step 2** — add the missing rule to the matching `styles/*.css` file. Dynamic
  fragments (`dlc-chip-{{color}}`) are exempt but must be documented in a CSS comment.
- **Step 3** — add the key to **both** `lang/en.json` and `lang/pl.json`.
- **Step 4** — a real regression in `module/core/`; fix the logic, not the test,
  unless the test itself encodes a rule that contradicts `deadlands-rules-ref`.

Do not paper over a failure by narrowing the command. `verify:all` is the contract.
