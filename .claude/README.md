# .claude/ — AI workshop

Claude Code integration for this repository. The authoritative, tool-neutral project context is
`AGENTS.md`; `CLAUDE.md` imports it and adds only Claude-specific integration notes.

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
| `settings.local.json` | ✗ (gitignored) | Minimal per-clone MCP enablement only; paths and secrets stay in the environment |
| `agents/*.md`, `skills/*/SKILL.md`, `hooks/*.sh`, `rules/*.md` | ✓ | Shared workshop — every contributor gets the same setup |

## Hooks

Wired in `settings.json` under `hooks`:

| Event | Matcher / filter | Script | What it does |
|---|---|---|---|
| `SessionStart` | — | inline | `git config core.hooksPath .githooks` so the `commit-msg` / `pre-commit` hooks apply on every clone |
| `PreToolUse` | `Write \| Edit \| Bash` | `hooks/protect-paths.mjs` | Blocks direct file-tool writes and common shell writes to protected repository paths. This is defense in depth; the OS sandbox is the security boundary. |
| `PostToolUse` | `Write \| Edit` | `hooks/post-write.sh` | `node --check` on `.mjs`, `JSON.parse` on `.json`, re-run `verify-documenttypes` after `system.json` / `lang/*.json` edits. Also nudges on mechanics files |
| `PostToolUse` | `Bash` + `if: Bash(*extract-pdf.sh *)` | `hooks/post-extract-verify.sh` | After an `extract-pdf.sh` call, runs `$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh`. FAIL injects `decision: block` so Claude stops before indexing a broken extract |
| `Stop` | — | `hooks/stop-verify.sh` | When the working tree is dirty, runs `npm run verify:ci` on every invocation and blocks while it is red |

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

**Path rules — file tools only.** `AGENTS.md` says never to modify `.git/`, `.agents/`,
`.codex/`, `vendor/`, `books/`, `.pdf-extract/` or `LICENSE`; `Edit(...)` deny rules
block Write/Edit tool calls to those targets:

```json
"Edit(/vendor/**)", "Edit(/books/**)", "Edit(/.pdf-extract/**)", "Edit(/LICENSE)"
```

They must be written as `Edit(...)`, **not** `Write(...)`. These permission rules do not
inspect shell redirections or subprocesses. Bash and its children are instead confined by
`sandbox.filesystem.denyWrite`, enforced by bubblewrap on Linux. The PreToolUse guard rejects
obvious attempts earlier and provides a readable error, but it is not a shell parser and must
not be treated as the isolation boundary.

**Bash argument rules — soft.** The `rm -rf`, `git push --force`, `git reset --hard` and
`git clean` entries are a speed bump, not a guarantee. Patterns that try to constrain
command arguments are fragile: `rm -fr`, `find -delete` and similar spellings sail straight
past them. Treat them as a typo-catcher, not a security boundary.

The sandbox is fail-closed (`failIfUnavailable: true`) and the unsandboxed escape hatch is
disabled. Sandboxed commands are auto-approved inside the workspace, while dependency
mutations such as `npm install` are denied and must be performed as a reviewed maintainer
operation. The network proxy permits only the domains listed in `settings.json` plus local
Foundry test traffic. Adding a domain is a reviewed repository change.

## Skills

- `/verify-system` — `npm run verify:ci`, one-paragraph report
- `/verify-foundry` — establish the exact Foundry build and authoritative API sources before
  Foundry-dependent edits; run the doctor and all local E2E flows afterward
- `/verify-mechanic` — verify a mechanic against `deadlands-rules-ref` **before** coding it;
  returns `<slug> p.NNN` + paraphrase. Delegates to `pdf-reference-lookup`
- `/release [major|minor|patch]` — prepare and validate a release PR; never tag automatically
- `/add-archetype <kebab-name> [--mechanics|--overlay]` — full archetype scaffold; delegates to
  `archetype-scaffolder`

The five canonical procedures live in `.agents/skills/`; files under `.claude/skills/` are thin
adapters. Skills are invoked with `/name` or automatically when their description matches a task.

## Agents

- `pdf-reference-lookup` — given a mechanic query, returns `<slug> p.NNN` plus a short
  paraphrase. It prefers MCP and requires `$DEADLANDS_RULES_PATH` for fallback.
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

Claude Code loads `.claude/rules/*.md` itself; `CLAUDE.md` imports canonical `AGENTS.md`.
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

One complete definition of green, shared by CI, the Stop hook and `/verify-system`:

```bash
npm run verify:ci
```

`verify:all` contains exactly five functional checks: document types/locales, CSS, i18n,
documentation integrity, and unit tests. `verify:ci` adds lint, `verify:ai`, and the mandatory
public-catalog citation/content audit in `verify:rules`; that audit never depends on a private
checkout being present in CI.
The pre-commit hook runs only `verify:fast`; it is intentionally not the complete gate.

## Local setup (one-time)

```bash
git config core.hooksPath .githooks    # done automatically by SessionStart hook
command -v bwrap
command -v socat
claude doctor
```

Export private rules and Foundry paths in your shell or an untracked environment manager:

```bash
export DEADLANDS_RULES_PATH=/path/to/deadlands-rules-ref
export FOUNDRY_EXECUTABLE=/path/to/foundryvtt
export FOUNDRY_DATA_PATH=/path/to/FoundryVTT
export FOUNDRY_WORLD=deadlands-test
```

Never store these paths, license keys, or passwords in project settings. The portable
`tools/deadlands-rules-mcp.sh` launcher reads `DEADLANDS_RULES_PATH` at runtime.
