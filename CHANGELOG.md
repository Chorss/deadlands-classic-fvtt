# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Project revival as Deadlands Classic — Community Edition.** Based on the work of [Dulux-Oz](https://github.com/Dulux-Oz/DeadlandsClassic) (GPL-3.0, newer, vendored for pattern research only) and [RhombusWeasel](https://github.com/RhombusWeasel/Deadlands-Classic) (MIT, older, Foundry v9-era, vendored for pattern research only). No code copied from either — architectural patterns only.
- **Phase 0 — repo metadata & AI workshop.** Foundation for iterative development under Foundry VTT V14.
- `CLAUDE.md` — project context loaded into every Claude Code session (stack, architectural patterns, directory layout, dev rules, sources of truth).
- `.claude/` workshop:
  - `settings.json` — 20 scoped permissions (node, npm, git read-only, Biome, PDF tooling), 8 denies for destructive ops, `SessionStart` hook that auto-wires `.githooks`, `PostToolUse` hooks dispatching to `post-write.sh` (`Write|Edit|MultiEdit`) and `post-extract-verify.sh` (`Bash`).
  - `hooks/post-write.sh` — immediate syntax/JSON validation per file extension, with `verify-documenttypes.mjs` for `system.json` and `lang/*.json`.
  - `rules/` — 5 path-scoped conventions (`commits`, `naming`, `v14-api`, `localization`, `references`) auto-loaded via `paths:` frontmatter.
  - `agents/pdf-reference-lookup.md` — subagent for rulebook citations (page + short fragment, never bulk prose).
  - `commands/` — `/verify-system` and `/release` slash commands.
- `.mcp.json` — Playwright MCP (browser automation for sheet E2E verification) + context7 MCP (library docs lookup).
- `.githooks/` — `pre-commit` (syntax + JSON + manifest validation) and `commit-msg` (rejects `Co-Authored-By: Claude` trailers; enforces conventional commit prefixes).
- `tools/verify-documenttypes.mjs` — manifest structure check and EN/PL key parity validation.
- `tests/smoke.test.mjs` — `node:test` placeholder so `npm run test` stays green from Phase 0.
- Build tooling: `package.json` (Node 24+ engine, scripts: `fmt`, `lint`, `test`, `verify`), `biome.json`, `.editorconfig`.
- Localization scaffolding: `lang/en.json` + `lang/pl.json` with 15 paired starter keys under `DEADLANDS.*`.
- Module entry `module/deadlands-classic.mjs` — init/ready hook skeleton + `game.deadlandsClassic` namespace.
- Styles entry `styles/deadlands-classic.css` — import skeleton for phases 2-5.
- PDF rulebook lookup workflow via the private `deadlands-rules-ref` repo (`$DEADLANDS_RULES_PATH`); the `pdf-reference-lookup` subagent resolves it per call. (Earlier in-repo `docs/pdf-index/` + `scripts/extract-pdf.sh` migrated out to that private repo.)
- Documentation: `docs/implementation-plan.md` (14-phase roadmap with architecture + registry contract), `docs/notes.md` (MIT rationale + workshop design rationale).
- GitHub templates: issue templates (bug, feature, config), PR template.

### Changed
- **License changed from GPL-3.0 to MIT** (pre-release). Aligns with Foundry ecosystem convention — `dnd5e`, `pf2e` (Apache-2.0), and the majority of community modules are permissive. No external contributions yet, so relicensing requires no third-party consent.
- **Target platform: Foundry VTT V14+.** Dropped V13 compatibility. Manifest restructured around `documentTypes` (replaces legacy `template.json`); sheets will use `ApplicationV2 + HandlebarsApplicationMixin` (not `Application`); editor is ProseMirror (not TinyMCE).
- **Actor types expanded:** added `madScientist` (core archetype, not dropped to expansion). Full list: `cowboy`, `huckster`, `shaman`, `blessed`, `madScientist`, `npc`, `mook`. Harrowed reclassified as an **overlay** (applicable on top of any archetype), not a standalone actor type.
- **Item types restructured:** added `armor`, `ammo` as core types. Archetype-specific types (`hex`, `miracle`, `favor`, `gizmo`) will be registered by their owning archetype manifests in phases 9-10, not declared core.
- **README** updated to V14-only compatibility table, v1 scope note (Classic only; HoE and Lost Colony deferred to v2+), and feature list including Legend chip (4th color, reroll bust), Mad Scientist archetype, Harrowed overlay, and 8 wound locations (per PDF p.133).

### Removed
- Draft item types `power` and `card` from the pre-release manifest. Replaced by archetype-specific types registered per manifest (phases 9-10) and a native Foundry `Cards` document for the action deck (phase 8). The Fate Pot is a world-level setting (a `{white,red,blue,legend}` DataModel), not a Cards deck.

### Notes
- Pre-release. No tagged version exists yet — first release will be `0.1.0` once Phase 0 is merged and the manifest boots cleanly in Foundry V14.
- No playable game logic yet — foundational scaffolding only.

[Unreleased]: https://github.com/Chorss/deadlands-classic-fvtt/commits/main
