# .claude/ — AI workshop

Claude Code configuration for this repository. Orientation only — the authoritative
project context is `CLAUDE.md` at the repo root, which auto-loads every session.

## Layout

```
.claude/
├── settings.json            shared, checked into git
├── settings.local.json      per-clone overrides, gitignored
├── agents/                  custom subagent definitions (one .md per agent)
├── skills/                  invocable procedures (one <name>/SKILL.md per skill)
├── hooks/                   shell scripts invoked by settings.json hooks
└── rules/                   focused rule docs, loaded natively by Claude Code
```

## What ships where

| File | In git? | Purpose |
|---|---|---|
| `settings.json` | ✓ | Shared permissions, hook wiring, shared env (`DEADLANDS_DEV`) |
| `settings.local.json` | ✗ (gitignored) | Per-machine `DEADLANDS_RULES_PATH`, domain allowlists, local tooling permissions |
| `agents/*.md`, `skills/*/SKILL.md`, `hooks/*.sh`, `rules/*.md` | ✓ | Shared workshop — every contributor gets the same setup |

## Hooks

Wired in `settings.json` under `hooks`:

| Event | Matcher / filter | Script | What it does |
|---|---|---|---|
| `SessionStart` | — | inline | `git config core.hooksPath .githooks` so the `commit-msg` / `pre-commit` hooks apply on every clone |
| `PostToolUse` | `Write \| Edit` | `hooks/post-write.sh` | `node --check` on `.mjs`, `JSON.parse` on `.json`, re-run `verify-documenttypes` after `system.json` / `lang/*.json` edits. Also nudges on mechanics files |
| `PostToolUse` | `Bash` + `if: Bash(*extract-pdf.sh *)` | `hooks/post-extract-verify.sh` | After an `extract-pdf.sh` call, runs `$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh`. FAIL injects `decision: block` so Claude stops before indexing a broken extract |
| `Stop` | — | `hooks/stop-verify.sh` | When the working tree is dirty, runs `npm run verify:all` and blocks the end of the turn with the failure text if it is red |

Three details worth knowing:

- **`post-write.sh` fails with `exit 2`, not `exit 1`.** `PostToolUse` surfaces a hook's
  stderr to Claude only on exit code 2. With `exit 1` the validation still ran and still
  failed, but the model never saw it.
- **The `if:` filter is what keeps the PDF gate cheap.** Without it the script spawned node
  on every single Bash call just to discover the command was unrelated. The filter is
  best-effort and fails open, so the script keeps its own `grep` as a second gate.
- **`Stop` is the only net under bash-written files.** `PostToolUse` on `Write|Edit` does
  not fire when a Bash command rewrites a file (`sed -i`, a heredoc, `>` redirection), so
  those edits bypass every per-write check. `stop-verify.sh` catches them before the turn ends.

## Permissions

`settings.json` splits into two kinds of deny rule, and they are not equally strong.

**Path rules — enforced.** `CLAUDE.md` says never to modify `vendor/`, `books/`,
`.pdf-extract/` or `LICENSE`; these make it true regardless of what Claude decides:

```json
"Edit(vendor/**)", "Edit(books/**)", "Edit(.pdf-extract/**)", "Edit(LICENSE)"
```

They must be written as `Edit(...)`, **not** `Write(...)`. Claude Code checks file
permissions against `Edit(path)` and `Read(path)` rules only; a `Write(path)` rule is
accepted, never consulted, and warned about at startup. `Edit(...)` also covers the target
of a shell output redirection, so `sed ... > vendor/x` is blocked too.

**Bash argument rules — soft.** The `rm -rf`, `git push --force`, `git reset --hard` and
`git clean` entries are a speed bump, not a guarantee. Patterns that try to constrain
command arguments are fragile: `rm -fr`, `find -delete` and similar spellings sail straight
past them. Treat them as a typo-catcher, not a security boundary.

## Skills

- `/verify-system` — `npm run lint` + `npm run verify:all`, one-paragraph report
- `/verify-mechanic` — verify a mechanic against `deadlands-rules-ref` **before** coding it;
  returns `<slug> p.NNN` + paraphrase. Delegates to `pdf-reference-lookup`
- `/release [major|minor|patch]` — cut a versioned release (bumps, tags, pushes; CI builds the zip)
- `/new-phase [N] [slug]` — create branch `phase-N/<slug>`, extract checklist + test block from
  `docs/implementation-plan.md`, list companion PDFs to verify
- `/add-archetype <kebab-name> [--mechanics|--overlay]` — full archetype scaffold; delegates to
  `archetype-scaffolder`

Skills are invoked with `/name` or automatically when their `description:` matches the task.
`/release` deliberately carries Polish trigger phrases ("zrób release", "taguj wersję") in its
description, so the maintainer's usual phrasing invokes it.

## Agents

- `pdf-reference-lookup` — given a mechanic query, returns `<slug> p.NNN` + a short
  quoted fragment from the rulebook extracts. Resolves `$DEADLANDS_RULES_PATH` on
  every call; falls back to local `.pdf-extract/` if unset.
- `mechanic-verifier` — audits **already-written** code or pack entries against the
  rulebook; produces a per-value MATCH/MISMATCH table with page cites. Use after
  coding a mechanic or during review.
- `foundry-v14-checker` — scans `module/**/*.mjs` for V13 anti-patterns (`extends Application`,
  `extends ActorSheet`, `template.json`, TinyMCE, hardcoded UI strings). Reports
  ❌ FAIL / ⚠ WARN / ✅ OK with file:line citations.
- `archetype-scaffolder` — given an archetype name, generates the full folder scaffold
  (`manifest.mjs`, `data.mjs`, `sheet.mjs`, stub `mechanics.mjs`, i18n keys EN+PL,
  `system.json` update, entry-point import). Invoke via `/add-archetype`.

## Rules

Claude Code loads `.claude/rules/*.md` itself — there are no `@`-includes in `CLAUDE.md`.
A rule **without** `paths:` frontmatter loads at session start with the same priority as
`CLAUDE.md`. A rule **with** `paths:` loads only when a matching file is read or written,
which keeps it out of sessions that never touch those files.

| File | When it loads | Scope |
|---|---|---|
| `commits.md` | every session | Conventional-commit prefixes, no AI co-author trailers |
| `naming.md` | every session | Casing matrix for keys, folders, classes, i18n |
| `code-quality.md` | on matching file | `module/**/*.mjs`, `tools/**/*.mjs`, `tests/**/*.mjs` — Biome rules, SOLID boundaries, OWASP patterns, complexity ≤ 15, CSS coverage |
| `v14-api.md` | on matching file | `module/**/*.mjs` — V14 API only, no V13 fallbacks |
| `localization.md` | on matching file | `lang/**/*.json`, `module/**/*.mjs`, `templates/**/*.hbs` — EN/PL key parity |
| `references.md` | on matching file | `vendor/**` — read, don't copy |
| `rulebook-authority.md` | on matching file | `module/**/*.mjs`, `tests/**/*.mjs`, `packs/**`, `docs/mechanics-reference.md` — `deadlands-rules-ref` is the only source of truth for game rules |

Path-scoped rules are **not** re-injected after `/compact`, which is why `post-write.sh`
keeps its own non-blocking reminder on mechanics files.

## Verification

One definition of green, shared by CI, the pre-commit hook and `/verify-system`:

```bash
npm run lint          # Biome — formatting + lint rules
npm run verify:all    # verify-documenttypes → audit-css → audit-i18n → tests
```

## Local setup (one-time)

```bash
git config core.hooksPath .githooks    # done automatically by SessionStart hook
```

Set the private rules-repo path in `settings.local.json`:

```json
{
  "env": {
    "DEADLANDS_RULES_PATH": "/absolute/path/to/deadlands-rules-ref"
  }
}
```

Without it, the post-extract quality gate hook will skip verification (no local fallback — scripts now live in `deadlands-rules-ref`).
