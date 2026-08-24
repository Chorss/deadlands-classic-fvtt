---
name: verify-foundry
description: Verify Foundry VTT API assumptions before and after changing Foundry-dependent code. Use automatically for ApplicationV2, ActiveEffect, Document, hook, sheet, world-time, login, or other Foundry API changes, and whenever upgrading the verified Foundry build.
---

# Verify Foundry V14 API work

Use this procedure for every change whose correctness depends on Foundry runtime behavior.

## Before coding

1. Read `system.json` and resolve `FOUNDRY_EXECUTABLE` (default `~/foundryvtt/foundryvtt`).
2. Read `<executable-dir>/resources/app/package.json`. Stop if its
   `release.generation` + `release.build` does not match `system.json.compatibility.verified`.
3. Consult sources in strict order:
   - release notes for the exact build and relevant intervening builds;
   - official `https://foundryvtt.com/api/v14/` API;
   - local `resources/app/client` and `resources/app/common` files from the installed build;
   - Context7/wiki only to help locate an authoritative answer.
4. Record which source establishes every build-sensitive assumption. Public V14 API docs
   currently identify themselves as 14.365; use 14.366 and 14.367 release notes plus local
   14.367 source for later differences.

## After coding

Run:

```bash
node tools/foundry-e2e-doctor.mjs
npm run test:e2e
```

The doctor must pass before Playwright. Report the installed build, whether Foundry was
reused or started by Playwright, and the E2E flow count. Do not store Foundry license keys,
administrator passwords, or world user passwords in repository files.
