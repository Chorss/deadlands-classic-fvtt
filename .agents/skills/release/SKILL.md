---
name: release
description: Prepare and validate a release pull request without creating or pushing a tag. Use for version bumps, release readiness, or publishing preparation.
---

# Prepare a release PR

This workflow prepares a reviewable release PR. It never creates or pushes a tag.

1. Require a clean tree and an up-to-date branch based on `origin/main`. Fetch tags and inspect
   commits since the latest semantic-version tag. Stop if a release workflow is already running.
2. Choose the SemVer bump from conventional commits, or validate an explicit version. Stop when
   there are no commits since the latest tag.
3. Create `release/<version>` and update the same version in all four release manifests:
   `system.json`, `package.json`, `package-lock.json`, and `content/module.json`. Use
   `npm version <version> --no-git-tag-version` for the package and lockfile, then update both
   Foundry manifests. Confirm exact equality mechanically.
4. Move `[Unreleased]` entries into `## [<version>] — YYYY-MM-DD` in `CHANGELOG.md` and create a
   fresh `[Unreleased]` section. Keep release notes English.
5. Run `npm run verify:ci`, `npm audit`, `npm run test:e2e`, and the Foundry publisher dry run.
   Release readiness requires every Playwright flow to pass on the supported build.
6. Commit only the four manifests and changelog with `chore: release <version>`, push the release
   branch, and open a PR using the repository template. Do not tag.

After the PR is merged, a maintainer starts from a fresh, current `main`, requires a clean tree,
re-runs `npm ci`, `npm run verify:ci`, `npm run test:e2e`, `npm audit`, version equality, and the
publisher dry run. Only then may the maintainer create the lightweight `<version>` tag from that
exact `main` commit and push it. Never tag a release-PR branch and never auto-push a tag.
