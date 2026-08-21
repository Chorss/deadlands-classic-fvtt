---
description: Create a versioned release — bumps semver in system.json + package.json, updates CHANGELOG, commits, tags main, and pushes (CI builds the zip and publishes the GitHub Release). Triggers — /release, "zrób release", "utwórz release", "taguj wersję", "wypuść wersję", "nowa wersja".
allowed-tools: Bash(git *), Bash(gh *), Bash(node *), Bash(node --check:*), Bash(node --test:*), Bash(npm run *), Read, Edit, Write, Grep, Glob
---

# Release

Cut a new versioned release of the Deadlands Classic system.

**What this command does:** sync version in `system.json` + `package.json`, close
the `[Unreleased]` section of `CHANGELOG.md`, run verify, commit, tag `main`, push.

**What CI does** (`.github/workflows/release.yml`, triggers on tag push):
re-validates the manifest, runs tests, extracts the matching CHANGELOG section
as release notes, builds `deadlands-classic.zip` (with a forbidden-path safety
net), and publishes the GitHub Release with `system.json` + zip as assets.

So: Claude edits + tags + pushes → GitHub runner does the build + publish. Local
`gh release create` and local zip-building are **not** part of this flow.

**Communication:** the maintainer prefers Polish in chat, but everything you
write to files — commit messages, CHANGELOG entries, preview framing in files —
stays in English. Only `lang/pl.json` is Polish.

## Step 1 — Verify state (run in parallel)

```bash
git fetch --tags origin
git branch --show-current
git status --porcelain
git rev-list --left-right --count origin/main...HEAD
git tag --sort=-version:refname | head -1
```

**Guard rails — stop and report if:**
- Current branch is NOT `main` → "Release must be cut from `main`. Current: {branch}"
- Working tree has uncommitted changes → list them, ask to commit / stash first
- Local `main` is ahead of `origin/main` by commits other than what you are about to add, or behind → ask the user to reconcile first
- A previous run of `.github/workflows/release.yml` is already in progress for another tag → warn the user before continuing (`gh run list --workflow=release.yml --limit 3`)

If no tags exist yet, treat the previous version as the one currently in
`system.json` (i.e. this is the first tagged release).

## Step 2 — Determine version to release

Read the current version and the commits since the last tag:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('system.json','utf8')).version)"
PREV=$(git tag --sort=-version:refname | head -1)
RANGE=${PREV:+${PREV}..HEAD}
git log ${RANGE:-HEAD} --oneline
```

**Parse commits by conventional-commit prefix (from `.claude/rules/commits.md`):**

| Section (Keep a Changelog) | Maps from |
|---|---|
| `### Added` | `feat:` |
| `### Fixed` | `fix:` |
| `### Changed` | `refactor:`, substantive `chore:` (tooling/CI/config changes) |
| `### Documentation` | `docs:` (only if user-visible — internal doc polish can stay under `### Changed`) |
| `### Tests` | `test:` (usually omitted from release notes unless user-visible) |

**Version bump rules (semver `MAJOR.MINOR.PATCH`, no "v" prefix):**

| Situation | Bump |
|---|---|
| Only `fix:` / `refactor:` / `chore:` / `docs:` / `test:` | PATCH: `0.1.0` → `0.1.1` |
| Any `feat:` | MINOR: `0.1.x` → `0.2.0` |
| Foundry `compatibility.minimum` bumped, public API removed, registry contract broken | MAJOR: ask user to confirm |

**Pre-1.0 note:** below `1.0.0` we're still in Phase 1–2 of
`docs/implementation-plan.md`. Breaking changes to not-yet-public registries
can land as MINOR — confirm with the user if unsure.

If there are **zero commits** since the last tag → stop:
"No new commits since {PREV}. Nothing to release."

If the user provided a version explicitly (e.g. `/release 0.2.0`) → use it
directly, skip bump logic but still validate that it's greater than the
current one.

## Step 3 — Draft the CHANGELOG entry (English)

The CI workflow reads release notes verbatim from the `## [{NEXT}]` section of
`CHANGELOG.md`, so **this section IS the release notes**. Draft it carefully.

**Template — Keep a Changelog style:**

```markdown
## [{NEXT}] — {YYYY-MM-DD}

### Added
- Short description — one line per commit or logical group

### Fixed
- Short description

### Changed
- Short description

### Documentation
- Short description
```

**Rules:**
- Language: **English** (CHANGELOG, commit messages, everything persisted in the repo)
- Skip empty sections entirely
- Skip `### Tests` unless the user explicitly wants test work surfaced
- One meaningful line per logical change; group related commits
- Do NOT include commit hashes, branch names, or AI co-author trailers
- Phase milestones from `docs/implementation-plan.md` (e.g. "Phase 1 complete") are worth calling out at the top when applicable
- CI will append a `**Full changelog:** ...compare/{PREV}...{NEXT}` link automatically — do not add it by hand

## Step 4 — Show preview and ask for confirmation

Show the user (Polish framing, English payload):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Release: {NEXT}   (poprzednia: {PREV | "brak — pierwszy release"})
 Typ: patch / minor / major
 Commity od ostatniego tagu: {N}

 Zmiany w plikach (commit "chore: release {NEXT}"):
   - system.json        version → {NEXT}
   - package.json       version → {NEXT}
   - CHANGELOG.md       [Unreleased] → [{NEXT}] — {YYYY-MM-DD}

 CHANGELOG.md entry (English — staje się release notes na GitHub):
─────────────────────────────────────
{new CHANGELOG section body}
─────────────────────────────────────

 Co się stanie po potwierdzeniu:
   1. Update system.json + package.json + CHANGELOG.md
   2. node tools/verify-documenttypes.mjs   (manifest + EN/PL parity)
   3. node --test tests/*.test.mjs          (unit tests)
   4. git commit "chore: release {NEXT}"
   5. git tag {NEXT}                        (lightweight)
   6. git push origin main                  (release commit)
   7. git push origin {NEXT}                (tag — uruchamia release.yml)
   8. CI workflow (release.yml) w tle:
        - rewalidacja manifestu i testów
        - build deadlands-classic.zip
        - gh release create {NEXT} --latest z system.json + zip

 Kontynuować? [tak/nie]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Wait for confirmation. If the user wants to adjust notes, version, or scope,
make the change and re-show the preview.

## Step 5 — Execute release

After confirmation, run the steps below. **Stop at the first failure** and
report what broke — do not try to unwind partial state automatically.

### 5a. Bump version in both manifests

Use `node` for atomic in-place edits (no `jq` dependency):

```bash
node -e '
  const fs = require("fs");
  for (const f of ["system.json", "package.json"]) {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    j.version = process.argv[1];
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
  }
' "{NEXT}"
npx biome check --write --unsafe system.json
```

> `JSON.stringify` expands inline arrays to multi-line; Biome must re-format `system.json`
> after the bump or `biome check` will fail in CI.

### 5b. Update CHANGELOG.md

Edit `CHANGELOG.md` with the Edit tool:
- Rename the existing `## [Unreleased]` heading to `## [{NEXT}] — {YYYY-MM-DD}` (use today's date from the session context)
- Insert a fresh empty `## [Unreleased]` section above it with the Keep a Changelog scaffolding:
  ```
  ## [Unreleased]

  ### Added

  ### Changed

  ### Fixed
  ```
- If the file uses reference-style links at the bottom, update them:
  ```
  [Unreleased]: https://github.com/Chorss/deadlands-classic-fvtt/compare/{NEXT}...HEAD
  [{NEXT}]: https://github.com/Chorss/deadlands-classic-fvtt/compare/{PREV}...{NEXT}
  ```
  If this is the first release (no `{PREV}`), point `[{NEXT}]` at
  `releases/tag/{NEXT}` or drop the line — it's optional.

The heading format `## [{NEXT}] — {YYYY-MM-DD}` MUST match the `awk` pattern in
`.github/workflows/release.yml` (`^## \[$VERSION\]`). If you rename the heading
style, update the workflow in the same commit.

### 5c. Run verification — MUST pass before tagging

```bash
node tools/verify-documenttypes.mjs
node --test tests/*.test.mjs
```

If either fails, stop — do not commit, tag, or push. Report the failure and
leave the working tree dirty so the user can inspect. CI runs the same checks
again on the runner, but failing locally is faster feedback and avoids a dead
tag on `origin`.

### 5d. Commit the release

```bash
git add system.json package.json CHANGELOG.md
git commit -m "chore: release {NEXT}"
```

Commit-msg hook at `.githooks/commit-msg` will reject any `Co-Authored-By: Claude`
trailer — do not add one. Ever.

### 5e. Tag and push

```bash
git tag {NEXT}                # lightweight tag, no "v" prefix
git push origin main          # push the release commit first
git push origin {NEXT}        # push the tag — this triggers release.yml
```

**Order matters:** push `main` *before* the tag. The CI workflow checks out the
tagged commit; if the tag is pushed before its commit exists on `origin`, the
runner can't fetch it.

## Step 6 — Confirm and report

After the tag is pushed, surface the CI run so the user can watch it:

```bash
gh run list --workflow=release.yml --limit 1 --json status,conclusion,url,headSha
```

Then report:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Release {NEXT} — lokalnie gotowy

 Manifests:   system.json + package.json → {NEXT}      ✓
 CHANGELOG:   [{NEXT}] — {YYYY-MM-DD}                  ✓
 Verify:      documentTypes + EN/PL parity + tests     ✓
 Commit:      chore: release {NEXT}                    ✓
 Tag:         {NEXT} (lightweight)                     ✓
 Push:        main + {NEXT}                            ✓

 CI workflow: {url from gh run list}
   - build deadlands-classic.zip
   - gh release create {NEXT} --latest (system.json + zip)

 Po zakończeniu CI:
   Release:          https://github.com/Chorss/deadlands-classic-fvtt/releases/tag/{NEXT}
   Foundry manifest: https://github.com/Chorss/deadlands-classic-fvtt/releases/latest/download/system.json

 Jeśli workflow padnie — napraw przyczynę, usuń tag (`git push --delete origin {NEXT} && git tag -d {NEXT}`),
 popraw commit i zrób /release jeszcze raz.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Hard rules

- ❌ Never tag a branch other than `main`
- ❌ Never use a "v" prefix on the tag (correct: `0.2.0`, wrong: `v0.2.0`)
- ❌ Never use `git tag -a` — project convention is lightweight tags
- ❌ Never write CHANGELOG entries or commit messages in Polish — English only. Polish lives only in `lang/pl.json` and in Claude ↔ maintainer chat
- ❌ Never add `Co-Authored-By: Claude <noreply@anthropic.com>` or any AI co-author trailer — the commit-msg hook rejects it, and `.claude/rules/commits.md` forbids it
- ❌ Never skip local verify (`verify-documenttypes.mjs` + `node --test`) — CI also runs it, but catching failures before the tag push avoids a dead tag on `origin` that the user then has to delete
- ❌ Never run `gh release create` locally — CI owns the release. If CI is broken and you truly must publish manually, say so explicitly and ask the user before taking over
- ❌ Never build the release zip locally — CI builds it in a clean runner. Local zips pick up untracked files and gitignored artefacts
- ❌ Never edit `.github/workflows/release.yml` without also keeping the `## [VERSION] — DATE` heading format in sync between CHANGELOG.md and the workflow's `awk` extractor
- ✅ Sync version in BOTH `system.json` AND `package.json` in a single commit
- ✅ CHANGELOG entry for `[{NEXT}]` becomes the release notes verbatim — draft it carefully, review it with the user
- ✅ Push `main` before pushing the tag
- ✅ CHANGELOG follows Keep a Changelog format already established in the file
- ✅ Commit message uses `chore:` prefix (per `.claude/rules/commits.md`)
