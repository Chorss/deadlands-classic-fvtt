---
paths:
  - "module/**/*.mjs"
---

# Foundry VTT V14 API rules

Target is V14+ only. V13 fallbacks and deprecated APIs are forbidden.

## Mandatory source hierarchy

Before changing Foundry-dependent code, establish the exact installed build and
use sources in this order:

1. Release notes for that exact build and every intervening build relevant to the change.
2. The official public API at `https://foundryvtt.com/api/v14/`.
3. Local client/common sources from the exact installed build when the public API is behind.
4. Context7 and the community wiki only as supporting discovery aids, never as authority over 1–3.

The maintained local target is **14.367**. The public V14 API is currently generated
for **14.365**, so changes introduced in 14.366–14.367 must be checked in their release
notes and, when necessary, `${FOUNDRY_EXECUTABLE%/*}/resources/app/{client,common}`.

## V13 anti-patterns — never write these

- `class X extends Application` → use `foundry.applications.api.ApplicationV2` + `HandlebarsApplicationMixin`.
- `template.json` manifest → use `documentTypes` in `system.json`.
- `game.system.template` / `game.system.model` access → data models ship via `TypeDataModel`, registered on `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels`.
- TinyMCE editor references → V14 uses ProseMirror (`foundry.applications.elements.HTMLProseMirrorElement`).
- `Actor.create({ type: "character" })` without a matching `documentTypes.Actor.character` entry — document types must be declared in `system.json` first.
- `libWrapper` as a hard dependency for core features — prefer native hooks.

## Preferred patterns

- **Data models** — `foundry.abstract.TypeDataModel` subclass per document subtype. Schema via `static defineSchema()` using `foundry.data.fields.*`.
- **Sheets** — `ApplicationV2 + HandlebarsApplicationMixin`. Define `static PARTS` and `static DEFAULT_OPTIONS`.
- **Registration** — wire `CONFIG.Actor.dataModels`, `CONFIG.Item.dataModels`, and `foundry.applications.apps.DocumentSheetConfig.registerSheet` in the `init` hook from `module/deadlands-classic.mjs`, sourced from the registries in `module/core/`.

## Verification

- Run `/verify-foundry` for Foundry API work. Its post-change gate is the local
  doctor followed by the complete Playwright suite on build 14.367.
