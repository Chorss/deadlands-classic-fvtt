# Adding a new archetype

Step-by-step tutorial for contributors adding a new PC archetype (e.g. "Blessed Gunslinger") or
NPC type. If you are adding an overlay (like Harrowed), see `architecture.md` §Harrowed instead.

> **Automated:** this entire tutorial is wrapped by the `/add-archetype` skill
> (`.claude/skills/add-archetype/SKILL.md`), which delegates to the `archetype-scaffolder` subagent —
> it generates the manifest/data/sheet files (plus optional mechanics), the EN+PL i18n keys, the
> `system.json` `documentTypes` entry, and the entry-point import in one pass. The manual steps
> below remain the reference for understanding exactly what the scaffold produces.

## Prerequisites

- Node 24+, `npm install` done.
- `git config core.hooksPath .githooks` set (enforces commit convention).
- The `fvtt` CLI comes in via `npm install` (a devDependency) — run it through `npm run pack` /
  `npm run unpack` when you need to rebuild compendium packs; no global install required.

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
| Sheet CSS class (`DEFAULT_OPTIONS.classes`) | `foo-bar` — matches the folder, not the ID |

See `CLAUDE.md §Naming conventions` for the full matrix.

---

## Step 2 — Create the folder scaffold

```
module/archetypes/foo-bar/
├── manifest.mjs      ← ArchetypeRegistry.register(...)
├── data.mjs          ← FooBarDataModel extends BaseCharacterDataModel
└── sheet.mjs         ← FooBarSheet extends BaseCharacterSheet
```

Optionally add `mechanics.mjs` for archetype-specific roll workflows. Sheet templates do **not**
live in the archetype folder — a custom tab goes in the shared
`templates/actor/parts/foo-bar-tab.hbs` and is wired in `sheet.mjs` (see the Optional section
at the end).

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
    classes: ["foo-bar"],
  };

  // Add a custom tab if needed — see huckster/sheet.mjs for an example.
}
```

`DEFAULT_OPTIONS` is **merged** with the parent's by ApplicationV2, so declare only what this
archetype adds — no `...super.DEFAULT_OPTIONS` spread and no manual `classes` concatenation
(see `v14-api-notes.md`). Every shipped sheet follows this shape; `module/archetypes/cowboy/sheet.mjs`
is the minimal one.

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
npm run lint          # Biome — formatting + lint rules
npm run verify:all    # manifest + EN/PL parity → CSS coverage → i18n keys → unit tests
```

These are the two commands CI runs. `verify:all` starts with `verify-documenttypes.mjs`, which
reports if `documentTypes.Actor` and `ArchetypeRegistry` are out of sync.

---

## Optional — mechanics.mjs and a custom sheet tab

If the archetype has a unique roll workflow (like Hucksters casting hexes):

1. Create `mechanics.mjs` with pure functions (unit-testable) and Foundry-dependent wrappers.
2. Create the HBS template under `templates/actor/parts/<foo-bar>-tab.hbs`.
3. In `sheet.mjs`, override `static PARTS` and `static TABS` to insert the tab, and add an action
   handler. **Overriding either one drops the inherited entries**, so re-import
   `HARROWED_SHEET_PART` / `HARROWED_SHEET_TAB` from `../_overlays/harrowed/sheet-tab.mjs` and
   place them back in your own `PARTS` / `TABS` — otherwise Harrowed characters of this archetype
   lose the skull tab:

   ```js
   import { HARROWED_SHEET_PART, HARROWED_SHEET_TAB } from "../_overlays/harrowed/sheet-tab.mjs";

   static PARTS = {
     header: { template: `${TEMPLATE_ROOT}/header.hbs` },
     tabs: { template: `${TEMPLATE_ROOT}/tabs.hbs` },
     traits: { template: `${TEMPLATE_ROOT}/traits-tab.hbs` },
     combat: { template: `${TEMPLATE_ROOT}/combat-tab.hbs` },
     fooBar: { template: `${TEMPLATE_ROOT}/foo-bar-tab.hbs` },
     harrowed: HARROWED_SHEET_PART,   // always declared; nav entry is conditional
     gear: { template: `${TEMPLATE_ROOT}/gear-tab.hbs` },
     bio: { template: `${TEMPLATE_ROOT}/bio-tab.hbs` },
   };
   ```

   The base sheet's `_prepareContext` deletes `context.tabs.harrowed` when the overlay is
   inactive, so the part stays declared while the nav entry only appears for Harrowed PCs
   (see `v14-api-notes.md`).
4. Add a `styles/archetypes/<foo-bar>.css` partial and `@import` it from
   `styles/deadlands-classic.css` — that entry file is the only stylesheet listed in
   `system.json → styles`, and `tools/audit-css.mjs` fails the build for any `dlc-*` class your
   new template uses without a matching selector.
5. If the archetype registers its own item type (as Huckster does with `hex`), add a
   `TYPES.Item.<id>` key to both `lang/en.json` and `lang/pl.json` and an entry to
   `system.json → documentTypes.Item`. `tools/verify-documenttypes.mjs` fails if `documentTypes`
   and `ItemRegistry` disagree.

Study `module/archetypes/huckster/` for a complete worked example.

---

## Optional — compendium pack

If the archetype ships with example items (spells, gizmos, etc.):

1. Create `packs/_source/<pack-name>/` with one JSON file per item. Name the pack after its
   contents, not after the archetype — the existing packs are `hexes-srd`, `edges-srd`,
   `hindrances-srd`, `action-deck`, `hit-location`, `archetype-examples`. There is no `-items`
   suffix convention.
2. Run `npm run pack` to compile to LevelDB.
3. Add the pack entry to `system.json → packs`; its `name` must match the folder name.

See `packs/_source/hexes-srd/` for an example.
