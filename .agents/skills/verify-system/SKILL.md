---
name: verify-system
description: Run the canonical project verification gate and report the result. Use before declaring repository work complete.
---

# Verify the system

Run `npm run verify:ci`. This is the only full definition of a green repository.
Do not substitute narrower commands. Report the failing stage and `file:line` on failure;
on success report the unit-test count. Reply to the maintainer in Polish.

`verify:ci` comprises lint, all five functional checks in `verify:all`, AI workshop
validation, and rule-source validation. Foundry-dependent runtime/UI work additionally
requires the `verify-foundry` procedure and `npm run test:e2e`.
