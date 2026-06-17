# Deadlands Classic — Community Edition

> Foundry VTT game system. See `docs/implementation-plan.md` for the full architectural
> roadmap; this document is the short orientation loaded into every Claude session.

## Stack & conventions

- **Target:** Foundry VTT **V14+** (V13 not supported, no back-compat shims).
- **Language:** JavaScript ES Modules (`.mjs`). No bundler, no TypeScript.
- **Typing:** JSDoc on public core APIs (registry contracts, dice helpers, chip/wound APIs).
- **Node:** 24+ (required by V14). `engines.node` in `package.json` enforces it.
- **Tooling:** Biome for fmt + lint (`npm run fmt`, `npm run lint`). `node:test` for unit tests.
- **License:** MIT.

## Architectural patterns

- **Registry pattern** — archetypes (Cowboy, Huckster, Shaman, Blessed, Mad Scientist, Harrowed overlay) and item types live in self-contained folders under `module/archetypes/` and register themselves via `ArchetypeRegistry` / `ItemRegistry` / `OverlayRegistry`. Core (`module/core/`) stays archetype-agnostic. Details in `docs/implementation-plan.md` §2.
- **Data models** — `foundry.abstract.TypeDataModel` per document type. `documentTypes` in `system.json` replaces the legacy `template.json`.
- **Sheets** — `foundry.applications.api.ApplicationV2` + `HandlebarsApplicationMixin`. TinyMCE is gone in V14; ProseMirror is the editor.
- **Game namespace** — `game.deadlandsClassic` is the single public API entry: `archetypes`, `items`, `overlays`, `dice`, `cards`, `chips`, `wounds`, `config`.

## Directory layout (brief)

```
module/
├── deadlands-classic.mjs   # entry (init + ready hooks)
├── core/                   # dice, cards, chips, wounds, registries — archetype-agnostic
└── archetypes/             # self-contained per-archetype modules (_base/ + cowboy/, huckster/, …)
templates/                  # Handlebars partials per sheet section
styles/                     # CSS entry + partials per concern
lang/                       # en.json, pl.json (key sets MUST match)
packs/                      # LevelDB compendium packs (V14 format)
tools/                      # verify-documenttypes.mjs and other repo tooling
tests/                      # node:test unit tests for pure core logic
docs/                       # plan, architecture, v14-api-notes, mechanics-reference, notes
```

Full layout: `docs/implementation-plan.md` §4.

## Dev rules

Detailed rules live in `.claude/rules/`. Two rules auto-load every session via the
`@`-includes at the bottom of this file: `commits.md` and `naming.md`. The rest
(`v14-api.md`, `localization.md`, `references.md`, `rulebook-authority.md`) carry a `paths:` frontmatter as
human-readable scope documentation — Claude reads them on demand when touching
matching files. The list below is a human-readable index.

- **Commits** — conventional commit prefixes, enforced by `.githooks/commit-msg`. → `commits.md`
- **Branch per feature.** Use `.github/PULL_REQUEST_TEMPLATE.md` on PRs.
- **V14 API only** — no V13 fallbacks, no deprecated APIs. → `v14-api.md`
- **Localization** — EN/PL key parity mandatory, no hardcoded UI strings. → `localization.md`
- **Game rules — one source of truth.** All mechanics come from `deadlands-rules-ref` (full catalog in `index/README.md`); `docs/mechanics-reference.md` is only a paraphrase; re-verify a mechanic before coding it. → rule `rulebook-authority.md`, skill `/verify-mechanic` (before coding), subagent `mechanic-verifier` (audit written code/packs), plus a non-blocking post-write reminder on mechanics files.
- **Naming conventions** — casing matrix for keys, folders, classes, i18n. → `naming.md`
- **Tests for core logic** — pure modules (exploding-roll, poker-evaluator, chip-rules, wound-track) ship with `node:test` unit tests. Foundry-dependent code is verified manually.
- **Phase order matters.** Follow `docs/implementation-plan.md` §5 — each phase ends with a working, testable system. Don't skip ahead.
- **Communication language.** The maintainer works in Polish; reply in Polish in chat and planning documents. Code, identifiers, commit messages, and this document stay in English.

## Sources of truth

| Topic | Location |
|---|---|
| Implementation roadmap | `docs/implementation-plan.md` |
| Architecture + registry contract | `docs/architecture.md` |
| V14 API patterns & code snippets | `docs/v14-api-notes.md` |
| Mechanics quick reference (⚠ **paraphrase** — subordinate to the rulebook source below) | `docs/mechanics-reference.md` |
| Extending with a new archetype | `docs/extending-archetypes.md` *(planned, Phase 14)* |
| Open questions / licensing notes | `docs/notes.md` |
| **Game rules — single authoritative source** (full rulebook catalog) | `$DEADLANDS_RULES_PATH/index/README.md` (catalog of every book) + `<slug>.md`; discipline → `.claude/rules/rulebook-authority.md` |
| Persistent memory across Claude sessions | `~/.claude/projects/.../memory/` (key knowledge distilled into `docs/`) |

## Reference projects

Two upstream projects vendored for pattern research under `vendor/`: `vendor/DeadlandsClassic/` (GPL-3.0) and `vendor/Deadlands-Classic/` (MIT). Read-only, never copy source — full constraints in `.claude/rules/references.md`.

## PDF rulebook

**`deadlands-rules-ref` is the single authoritative source for all Deadlands game rules.** Its catalog
`index/README.md` lists **every** indexed rulebook — core (`dlc`), the archetype companions (`hnh`,
`ghost-dancers`, `fb`, `snr`, `bod`), regional sourcebooks, adventures, magazines, the Polish MAG
translations (`*-pl`, the PL terminology canon), and conversions (~50 books, each with a page offset and
extract-quality flag). When a rule is in question this source wins — over memory, over the paraphrased
`docs/mechanics-reference.md`, and over the `vendor/` reference projects. Re-verify a mechanic here (via
the `pdf-reference-lookup` subagent) before coding it. Discipline: `.claude/rules/rulebook-authority.md`.

Source PDFs and extracts live in the private repo `deadlands-rules-ref`. Configure the path in
`.claude/settings.local.json` (key `env.DEADLANDS_RULES_PATH`). Without it, scripts fall back
to local `books/` and `.pdf-extract/`.

The `pdf-reference-lookup` subagent resolves the active path automatically — it runs
`echo "${DEADLANDS_RULES_PATH:-}"` at the start of every lookup. Fast path: pass it a mechanic
question; returns `<slug> p.NNN` + one short verification fragment, never bulk prose.

Use extracts for **mechanical lookup only** — page numbers and rule phrasing in your own words.
Never paste rulebook prose into code, commits, compendium packs, issue descriptions, or PR bodies.

### Extract format — which to use

| Content type | File |
|---|---|
| Prose rules, descriptions, narrative | `full.txt` |
| Tables, hit locations, weapon stats, sidebars | `full.layout.txt` |
| Character sheet, diagrams, illustrations | `Read` raw PDF `pages:"N-M"` (max 20 pages/call) |

### Page offset

All `[p.NNN]` markers and index entries use **physical PDF pages** (1-indexed from cover).
Each catalog entry in `$DEADLANDS_RULES_PATH/index/README.md` has an "Offset" column — add it to the
printed ToC page to get the physical page.

Example: dlc offset +1, ToC says "Hucksters p.153" → grep `[p.154]`.

Page-range grep:
```bash
awk -v lo=154 -v hi=160 '/^\[p\.[0-9]+\]/ {
  split($1, a, "."); n = a[2]+0; if (n>=lo && n<=hi) print
}' "$DEADLANDS_RULES_PATH/extracts/dlc/full.txt"
```

(Fallback path without `DEADLANDS_RULES_PATH`: `.pdf-extract/dlc/full.txt`.)

### Before trusting an extract

Run `$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh <slug>` before using any extract for the first time:
- **PASS** — reliable; proceed.
- **WARN** — usable, verify manually (common with illustration-heavy books: `cog`, `fof`).
- **FAIL** — extract is garbage; do not use. OCR the PDF and re-extract.

The PostToolUse hook fires this check automatically after every `extract-pdf.sh` call.
A FAIL result injects `decision: block` — no indexing until fixed.

### New PDF extraction checklist

1. Text layer check: `pdftotext -f 1 -l 5 "$pdf" - | wc -l` — fewer than 30 lines = scan-only.
2. Scan-only PDFs: `ocrmypdf books/<file>.pdf books/<file>.pdf --output-type pdf`, then re-extract.
3. Run `$DEADLANDS_RULES_PATH/scripts/extract-pdf.sh <pdf> <slug>` — auto-selects `-layout` or `-raw`.
4. Quality gate fires via hook; FAIL blocks indexing until fixed.
5. After PASS: create `$DEADLANDS_RULES_PATH/index/<slug>.md`, add row to `$DEADLANDS_RULES_PATH/index/README.md`.

## Editable surface

You may edit, without asking, files under: `module/`, `templates/`, `styles/`, `lang/`, `packs/`, `docs/`, `tools/`, `tests/`, `.claude/`, `.github/`, `.githooks/`, plus root metadata (`system.json`, `package.json`, `biome.json`, `.editorconfig`, `.gitignore`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`).

Ask before editing anything else — in particular, never modify `vendor/`, `books/`, `.pdf-extract/`, `LICENSE`, or files inside unfamiliar directories without explicit user confirmation.

## Quick verification

Before declaring a task done:

```bash
node tools/verify-documenttypes.mjs   # manifest + EN/PL key parity
node --test tests/*.test.mjs          # unit tests
```

The `/verify-system` slash command wraps both in a one-paragraph report.

---

## Auto-loaded rule files

@.claude/rules/commits.md
@.claude/rules/naming.md
