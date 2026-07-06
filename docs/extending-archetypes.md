# Adding a new archetype

Step-by-step tutorial for contributors adding a new PC archetype (e.g. "Blessed Gunslinger") or
NPC type. If you are adding an overlay (like Harrowed), see `architecture.md` §Harrowed instead.

> **Automated:** this entire tutorial is wrapped by the `/add-archetype` slash command
> (`.claude/commands/add-archetype.md`), which delegates to the `archetype-scaffolder` subagent —
> it generates the manifest/data/sheet files (plus optional mechanics), the EN+PL i18n keys, the
> `system.json` `documentTypes` entry, and the entry-point import in one pass. The manual steps
> below remain the reference for understanding exactly what the scaffold produces.

## Prerequisites

- Node 24+, `npm install` done.
- `git config core.hooksPath .githooks` set (enforces commit convention).
- `fvtt` CLI installed globally if you need to rebuild compendium packs.

---

## Step 1 — Pick an ID

The ID must be `camelCase`. It maps to one entry in each of:

| Where | Value |
|---|---|
| `system.json documentTypes.Actor` key | `fooBar` |
| `ArchetypeRegistry.register({ id: ... })` | `"fooBar"` |
| Folder name under `module/archetypes/` | `foo-bar` |
| JS classes | `FooBarDataModel`, `FooBarSheet` |
| i18n namespace | `TYPES.Actor.fooBar`, `DEADLANDS.Archetype.FooBar.*` |

See `CLAUDE.md §Naming conventions` for the full matrix.

---

## Step 2 — Create the folder scaffold

```
module/archetypes/foo-bar/
├── manifest.mjs      ← ArchetypeRegistry.register(...)
├── data.mjs          ← FooBarDataModel extends BaseCharacterDataModel
└── sheet.mjs         ← FooBarSheet extends BaseCharacterSheet
```

Optionally add `mechanics.mjs` for archetype-specific roll workflows and a
`templates/foo-bar-tab.hbs` for a custom sheet tab (wire it in `sheet.mjs`).

### manifest.mjs

```js
import { ArchetypeRegistry } from "../../core/archetype-registry.mjs";
import { FooBarDataModel } from "./data.mjs";
import { FooBarSheet } from "./sheet.mjs";

ArchetypeRegistry.register({
  id: "fooBar",
  label: "TYPES.Actor.fooBar",
  dataModel: FooBarDataModel,
  sheetClass: FooBarSheet,
  defaultIcon: "icons/environment/people/person.webp",
  htmlFields: ["system.biography"],
});
```

### data.mjs

```js
import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

export class FooBarDataModel extends BaseCharacterDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      ...super.defineSchema(),
      // Add archetype-specific fields here.
      // Example: a resource tracker unique to this archetype.
      myResource: new f.NumberField({ integer: true, min: 0, initial: 0 }),
    };
  }
}
```

### sheet.mjs

```js
import { BaseCharacterSheet } from "../_base/base-character-sheet.mjs";

export class FooBarSheet extends BaseCharacterSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...(super.DEFAULT_OPTIONS.classes ?? []), "foobar"],
  };

  // Add a custom tab if needed — see huckster/sheet.mjs for an example.
}
```

---

## Step 3 — Wire into the entry point

Add one import line to `module/deadlands-classic.mjs`:

```js
// Archetype manifests self-register on import.
import "./archetypes/foo-bar/manifest.mjs";
```

---

## Step 4 — Add to `system.json`

```json
"documentTypes": {
  "Actor": {
    "fooBar": { "htmlFields": ["system.biography"] }
  }
}
```

---

## Step 5 — Add i18n keys

Both `lang/en.json` and `lang/pl.json` must receive the same keys in the **same commit** — the pre-commit hook enforces parity.

Minimum keys:

```json
"TYPES.Actor.fooBar": "Foo Bar",
"DEADLANDS.Archetype.FooBar.Label": "Foo Bar"
```

Add any archetype-specific sheet keys under `DEADLANDS.Archetype.FooBar.*`.

---

## Step 6 — Verify

```bash
node tools/verify-documenttypes.mjs   # manifest + EN/PL key parity + registry comparison
node --test tests/*.test.mjs          # unit tests (no Foundry runtime needed)
```

`verify-documenttypes.mjs` will report if `documentTypes.Actor` and `ArchetypeRegistry` are out of sync.

---

## Optional — mechanics.mjs and a custom sheet tab

If the archetype has a unique roll workflow (like Hucksters casting hexes):

1. Create `mechanics.mjs` with pure functions (unit-testable) and Foundry-dependent wrappers.
2. In `sheet.mjs`, add the tab to `static PARTS` and `static TABS`, and add an action handler.
3. Create the HBS template under `templates/actor/parts/<foo-bar>-tab.hbs`.

Study `module/archetypes/huckster/` for a complete worked example.

---

## Optional — compendium pack

If the archetype ships with example items (spells, gizmos, etc.):

1. Create `packs/_source/<foo-bar>-items/` with one JSON file per item.
2. Run `npm run pack` to compile to LevelDB.
3. Add the pack entry to `system.json → packs`.

See `packs/_source/hexes-srd/` for an example.
