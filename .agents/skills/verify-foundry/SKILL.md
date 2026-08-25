---
name: verify-foundry
description: Verify Foundry VTT V14 API assumptions and run the complete supported-build E2E suite for runtime, UI, document, hook, sheet, or world-time changes.
---

# Verify Foundry V14 work

Before coding, read `system.json`, resolve `FOUNDRY_EXECUTABLE`, and compare the installed
`resources/app/package.json` generation/build with `compatibility.verified`. Stop on a mismatch.

Establish build-sensitive behavior from, in order: release notes for the exact build, official
V14 API docs, then installed `resources/app/client` and `resources/app/common` source. Record the
source for each assumption. Do not add V13 compatibility shims.

After coding run:

```bash
node tools/foundry-e2e-doctor.mjs
npm run test:e2e
```

Report the installed build and passed/total Playwright flows. Do not store Foundry paths,
credentials, license keys, or world passwords in the repository.
