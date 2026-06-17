---
description: Full system sanity check — manifest, syntax, tests, lang parity
allowed-tools: Bash(node:*), Bash(node --check:*), Bash(node --test:*), Bash(npm run test:*), Bash(npm run verify:*)
---

Run the repository's sanity checks and give a ONE-PARAGRAPH summary (done / failed).
Do not verbose-dump command outputs — surface only failures and their file:line.

Execute in order, stopping at the first failure:

1. `node tools/verify-documenttypes.mjs` — manifest structure + EN/PL key parity.
2. `node --check module/deadlands-classic.mjs` and any other `.mjs` files under `module/` and `tools/` that have been edited since the last clean verify.
3. `node --test tests/*.test.mjs` — smoke + unit tests.

Report format:
- `verify-system OK` on success.
- `verify-system FAILED: <short reason>` on failure, with the offending file path.
