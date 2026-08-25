## Summary

<!-- What changed, why it is needed, and the main risk. -->

Closes #

## Change type

- [ ] Bug fix
- [ ] Feature or mechanic
- [ ] Refactor or cleanup
- [ ] Documentation or workshop configuration
- [ ] Dependency update
- [ ] Release preparation

## Foundry impact

Choose exactly one:

- [ ] No Foundry runtime, UI, or API impact
- [ ] Foundry runtime, UI, or API impact — E2E is required

Choose exactly one verification result:

- [ ] Foundry E2E not required — no runtime, UI, or API impact
- [ ] Foundry E2E passed — 10/10 on Foundry 14.367

Foundry build and result details:

## Deadlands mechanics and content

Choose exactly one:

- [ ] No Deadlands mechanic or content impact
- [ ] Deadlands mechanic or content impact — evidence is required

## Rulebook evidence

<!-- Write `N/A`, or list validated citations in `<slug> p.N` format and summarize the comparison. -->

## Verification

- [ ] `npm run verify:ci` passes

Result or CI link:

## Untested

<!-- Write `None`, or explicitly list every part that was not tested and why. -->

## Final checklist

- [ ] No unrelated files changed
- [ ] User-visible changes are recorded under `CHANGELOG.md` `[Unreleased]`
- [ ] Release PRs synchronize `system.json`, `package.json`, `package-lock.json`, and `content/module.json`
- [ ] No secrets, private paths, personal data, rulebook prose, or generated private artifacts are included
