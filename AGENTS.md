# Deadlands Classic — project instructions

This is the canonical, tool-neutral guidance for every coding agent working in this
repository. Tool-specific files may add integration details but must not redefine these rules.

## Communication

- Speak to the maintainer in Polish, including plans and hand-off reports.
- Keep code, identifiers, comments, persisted documentation, commit messages, and PR text in
  English. Polish belongs in `lang/pl.json` and maintainer conversation.
- Lead with the result. State assumptions, untested areas, and blockers explicitly.

## Platform and architecture

- Target Foundry VTT V14 only. `system.json.compatibility.verified` is the exact supported
  build for runtime verification; do not add V13 fallbacks or deprecated APIs.
- Use JavaScript ES modules (`.mjs`) and JSDoc for public core APIs. There is no bundler and no
  TypeScript. Node 24+ is required.
- Use `foundry.abstract.TypeDataModel` for document types and ApplicationV2 with
  HandlebarsApplicationMixin for sheets. ProseMirror replaces TinyMCE.
- Keep `module/core/` archetype-agnostic. Archetypes self-register from
  `module/archetypes/<name>/manifest.mjs` through `ArchetypeRegistry`; items use
  `ItemRegistry`; overlays such as Harrowed use `OverlayRegistry` and never add a new actor
  document type.
- `game.deadlandsClassic` is the single public namespace. Preserve its registry, dice, cards,
  chips, wounds, and config contracts unless the task explicitly authorizes an API change.
- Treat JSON under `packs/_source/` and `content/_source/` as source; built LevelDB pack
  directories are generated artifacts.

Architecture details live in `docs/architecture.md`, V14 patterns in `docs/v14-api-notes.md`,
and extension guidance in `docs/extending-archetypes.md`.

## Sources of truth

| Topic | Location |
|---|---|
| Architecture and registries | `docs/architecture.md` |
| Extending archetypes | `docs/extending-archetypes.md` |
| Rulebook-to-code feature gaps | `docs/feature-gap-roadmap.md` |
| Mechanic citation index | `docs/mechanics-reference.md` |
| World-data migrations | `docs/migration-policy.md` |
| Resolved design notes | `docs/notes.md` |
| Private rule-reference setup | `docs/rules-reference-mcp.md` |
| Foundry E2E setup | `docs/testing-e2e.md` |
| Foundry V14 API notes | `docs/v14-api-notes.md` |

## Editable surface and safety

Normal implementation work may edit `module/`, `templates/`, `styles/`, `lang/`,
`packs/_source/`, `content/_source/`, `docs/`, `tools/`, `tests/`, `.claude/`, `.github/`,
`.githooks/`, and the root project metadata.

Never write to `.git/`, `.agents/`, `.codex/`, `vendor/`, `books/`, `.pdf-extract/`, or
`LICENSE` unless the user explicitly asks for a workshop/configuration change whose target is
one of those paths. Never commit private extracts, PDFs, SQLite caches, secrets, Foundry world
data, absolute local paths, IDE ports, or generated package archives.

Preserve unrelated local changes. Do not use destructive Git commands, rewrite shared history,
force-push, or bypass hooks. Use one branch per logical change and conventional commit prefixes.
Do not add AI co-author trailers. A PR description and green tests do not replace review.

## Localization and code quality

- Every user-facing string uses a `DEADLANDS.*` key. Keep `lang/en.json` and `lang/pl.json` key
  sets identical.
- Follow the naming matrix in `.claude/rules/naming.md`: document/registry ids camelCase,
  directories kebab-case, classes PascalCase, and localization keys PascalCase segments.
- Biome owns formatting and lint. Keep cognitive complexity at or below 15, validate all
  external input, avoid global mutable state, and keep Foundry-dependent code at boundaries so
  pure mechanics remain unit-testable.
- Template CSS classes must have a real selector or a precise documented runtime exception.
  Dynamic i18n keys must be enumerated and tested, not exempted by broad prefixes.

## Rulebook evidence

For any Deadlands mechanic, number, table, or page citation, prefer the local
`deadlands-rules-ref` MCP server when registered. Its tools are evidence only:

1. Search for the question.
2. Read only the short returned page range.
3. Compare the evidence with the proposed behavior.
4. Validate the final citation.
5. Implement and test only after the comparison matches.

Paraphrase and cite `<slug> p.N`; never copy book prose into this public repository. The
rulebook source wins over model memory, `docs/mechanics-reference.md`, and vendored projects.

If MCP is unavailable, require `DEADLANDS_RULES_PATH`, search its catalog/extracts with
`rg`/`awk`, and run `$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh <slug>` before trusting
an extract. Stop if the variable or script is unavailable. Private extracts, PDFs, paths, and
cache data must stay outside this repository. See `docs/rules-reference-mcp.md`.

## Verification commands

- `npm run verify:fast` — quick pre-commit subset; never describe it as complete validation.
- `npm run verify:all` — five project checks: document types/locales, CSS, i18n, documentation,
  and unit tests. It excludes E2E and workshop-specific audits.
- `npm run verify:ai` — agent JSON/TOML/shell, hooks, skills, MCP, release manifests, and path
  protections.
- `npm run verify:rules` — mandatory public catalog and citation validation.
- `npm run verify:ci` — canonical green gate: lint + `verify:all` + `verify:ai` +
  `verify:rules`.
- `npm run test:e2e` — all Playwright flows on the exact Foundry build declared in
  `system.json`; required for runtime/UI/Foundry API changes and release readiness.

The current branch may introduce these commands incrementally. Until a script exists, use the
documented predecessor and never claim a missing gate ran.

## Definition of Done

Before declaring implementation complete:

1. Re-read the diff and confirm no unrelated or protected files changed.
2. Run `npm run verify:ci` successfully.
3. For Foundry-dependent changes, run `npm run test:e2e` on the verified build and report the
   flow count.
4. For mechanic/content changes, include validated `<slug> p.N` citations and ensure
   `verify:rules` passes.
5. Keep `CHANGELOG.md` current for user-visible changes and list anything not tested.

Five shared workflows live under `.agents/skills`: `verify-system`, `verify-foundry`,
`verify-mechanic`, `release`, and `add-archetype`. Use the matching procedure when the task
triggers it.
