---
name: add-archetype
description: Scaffold and validate a Foundry V14 actor archetype or character overlay using the repository's current registry and data-model contracts.
---

# Add an archetype or overlay

Use kebab-case folders, camelCase registry/document ids, and PascalCase classes. Inspect Cowboy
for a minimal archetype and Harrowed for the current overlay contract before generating files.

For a regular archetype:

1. Create `module/archetypes/<kebab>/manifest.mjs`, `data.mjs`, and `sheet.mjs`; add
   `mechanics.mjs` only when verified mechanics exist.
2. Extend `BaseCharacterDataModel`, whose actual actor fields include traits, aptitudes, wind,
   wounds, fate chips, bounty, gear, and `biography` as an `HTMLField`.
3. Register `id`, `label`, `dataModel`, `sheetClass`, optional mechanics/default icon, and
   `htmlFields: ["system.biography"]` with `ArchetypeRegistry`.
4. Add `documentTypes.Actor.<camelId>.htmlFields = ["system.biography"]` to `system.json`, the
   `TYPES.Actor` label to both locales, and the manifest import to the entry point. Never add an
   empty actor definition while declaring the HTML field only in the manifest.

For an overlay:

1. Create it under `module/archetypes/_overlays/<kebab>/` and follow Harrowed's contract:
   `schemaFields` is a function returning fields merged into every applicable base character;
   `isActive(actor)` is a predicate; `sheetTab` contains `{tab, part}`; mechanics are callbacks;
   `appliesTo` is optional.
2. Register with `OverlayRegistry`. Do not create a `documentTypes.Actor` entry and do not model
   an overlay as an archetype data model.

For either kind, add EN/PL key parity, templates/styles if needed, and unit tests for pure logic.
Validate generated content with `node --check` for every module, JSON parsing for changed JSON,
`npm run verify:ci`, and `npm run test:e2e` when runtime/sheet behavior changed. Mechanic-bearing
scaffolds must first follow `verify-mechanic` and use validated `<slug> p.N` citations.
