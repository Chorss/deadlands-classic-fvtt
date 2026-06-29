# .claude/ — AI workshop

Claude Code configuration for this repository. Orientation only — the authoritative
project context is `CLAUDE.md` at the repo root, which auto-loads every session.

## Layout

```
.claude/
├── settings.json            shared, checked into git
├── settings.local.json      per-clone overrides, gitignored
├── agents/                  custom subagent definitions (one .md per agent)
├── commands/                slash commands (one .md per command)
├── hooks/                   shell scripts invoked by settings.json hooks
└── rules/                   focused rule docs referenced from CLAUDE.md
```

## What ships where

| File | In git? | Purpose |
|---|---|---|
| `settings.json` | ✓ | Shared permissions, hook wiring, shared env (`DEADLANDS_DEV`) |
| `settings.local.json` | ✗ (gitignored) | Per-machine `DEADLANDS_RULES_PATH`, domain allowlists, local tooling permissions |
| `agents/*.md`, `commands/*.md`, `hooks/*.sh`, `rules/*.md` | ✓ | Shared workshop — every contributor gets the same setup |

## Hooks

Wired in `settings.json` under `hooks`:

| Event | Matcher | Script | What it does |
|---|---|---|---|
| `SessionStart` | — | inline | `git config core.hooksPath .githooks` so the `commit-msg` / `pre-commit` hooks apply on every clone |
| `PostToolUse` | `Write \| Edit \| MultiEdit` | `hooks/post-write.sh` | `node --check` on `.mjs`, `JSON.parse` on `.json`, re-run `verify-documenttypes` after `system.json` / `lang/*.json` edits |
| `PostToolUse` | `Bash` | `hooks/post-extract-verify.sh` | After every `extract-pdf.sh` call (any path), runs `$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh`. FAIL injects `decision: block` so Claude stops before indexing a broken extract |

## Commands

- `/verify-system` — manifest + EN/PL parity + tests, one-paragraph report
- `/release` — cut a versioned release (bumps, tags, pushes; CI builds the zip)

## Agents

- `pdf-reference-lookup` — given a mechanic query, returns `<slug> p.NNN` + a short
  quoted fragment from the rulebook extracts. Resolves `$DEADLANDS_RULES_PATH` on
  every call; falls back to local `.pdf-extract/` if unset.

## Rules

Focused per-topic docs. `CLAUDE.md` pulls `commits.md` and `naming.md` into every
session via `@`-include; the rest are read on demand when Claude touches files
matching their `paths:` frontmatter.

| File | Auto-loaded? | Scope |
|---|---|---|
| `commits.md` | ✓ every session | Conventional-commit prefixes, no AI co-author trailers |
| `naming.md` | ✓ every session | Casing matrix for keys, folders, classes, i18n |
| `v14-api.md` | on demand | `module/**/*.mjs` — V14 API only, no V13 fallbacks |
| `localization.md` | on demand | `lang/**`, `module/**`, `templates/**` — EN/PL key parity |
| `references.md` | on demand | `vendor/**` — read, don't copy |

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
