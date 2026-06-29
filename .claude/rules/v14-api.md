---
paths:
  - "module/**/*.mjs"
---

# Foundry VTT V14 API rules

Target is V14+ only. V13 fallbacks and deprecated APIs are forbidden.

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

- Reference docs: https://foundryvtt.com/api/ (V14), https://foundryvtt.wiki/.
