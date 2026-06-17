# Foundry V14 API notes

> Patterns, snippets, and breaking changes for building this system on Foundry VTT V14.
> Verified against **Foundry 14.364** (2026-06-17). V14+ only — no V13 back-compat shims.

## Support target

- `compatibility.minimum: "14"`. Pin `compatibility.verified` to a concrete tested build
  (e.g. `14.364`), not a bare `"14"` — V14 only reached Stable at 14.359 (April 2026).
- **Node.js 24+** (required by V14; V13 does not run on Node 24).

## documentTypes (system.json)

`documentTypes` replaces the legacy `template.json` entirely. Current shape (see `system.json` for
the live version):

```jsonc
"documentTypes": {
  "Actor": { "cowboy": {…}, "huckster": {…}, "shaman": {…}, "blessed": {…},
             "madScientist": {…}, "npc": {…}, "mook": {} },  // htmlFields ["system.biography"] on all but mook
  "Item":  { "weapon": {}, "armor": {}, "gear": {},
             "edge": {…}, "hindrance": {…}, "ammo": {} }      // htmlFields ["system.description"] on edge/hindrance
}
```

Archetype-specific item types (`hex`, `miracle`, `favor`, `gizmo`) are added by their archetype
manifests in Phases 9-10, not declared in Phase 0.

## Registration (init hook)

```javascript
Hooks.once("init", () => {
  CONFIG.Actor.documentClass = DeadlandsActor;
  CONFIG.Item.documentClass  = DeadlandsItem;
  CONFIG.Actor.dataModels = ArchetypeRegistry.dataModels(); // { cowboy: CowboyModel, … }
  CONFIG.Item.dataModels  = ItemRegistry.dataModels();

  for (const def of ArchetypeRegistry.all()) {
    foundry.documents.collections.Actors.registerSheet("deadlands-classic", def.sheetClass, {
      types: [def.id], makeDefault: true, label: def.label
    });
  }
});
```

## TypeDataModel

```javascript
class CowboyDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      biography: new f.HTMLField(),
      wind: new f.SchemaField({
        value: new f.NumberField({ integer: true, min: 0, initial: 10 }),
        max:   new f.NumberField({ integer: true, min: 1, initial: 10 })
      })
    };
  }
  prepareBaseData() { /* invariants before active effects */ }
  prepareDerivedData() { /* computed fields after effects — e.g. wind.max from Vigor+Spirit */ }
  static migrateData(source) { return super.migrateData(source); } // seed from day one (plan §8)
}
```

Wind fields are `system.wind.value` / `system.wind.max` — matches `primaryTokenAttribute:
"wind.value"` and the Foundry `{value, max}` resource-bar idiom.

## Sheets — ApplicationV2 + HandlebarsApplicationMixin

TinyMCE is gone in V14; rich text is ProseMirror. **Mind the namespaces** — `ApplicationV2` and the
mixin come from `foundry.applications.api`, but `ActorSheetV2` comes from `foundry.applications.sheets`:

```javascript
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets; // sheets, NOT api

class CowboySheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["deadlands-classic", "sheet", "actor", "cowboy"],
    position: { width: 720, height: 680 },
    window: { resizable: true },
    actions: { rollTrait: CowboySheet.#onRollTrait, spendChip: CowboySheet.#onSpendChip }
  };
  static PARTS = {
    traits: { template: "systems/deadlands-classic/templates/actor/parts/traits-tab.hbs" },
    combat: { template: "systems/deadlands-classic/templates/actor/parts/combat-tab.hbs" },
    gear:   { template: "systems/deadlands-classic/templates/actor/parts/gear-tab.hbs" },
    bio:    { template: "systems/deadlands-classic/templates/actor/parts/bio-tab.hbs" }
  };
  async _prepareContext(options) { /* return Handlebars context */ }
  static #onRollTrait(event, target) { /* click handler */ }
}
```

Registration: `foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "deadlands-classic", Sheet, { types:
["cowboy"], makeDefault: true })` (or `Actors.registerSheet`) in `init`.

## Cards API — Action Deck only

Native `foundry.documents.Cards` (type `deck`) is used **only** for the Action Deck (52 + 2 Jokers —
unique cards). The **Fate Pot is NOT Cards** — it is a world-level `game.settings` entry of a small
DataModel `{white, red, blue, legend}` (`config: false`), wrapped by a `FatePot` class. Cards model
unique cards, not fungible counters.

⚠ Cards has **no native bridge to Combat/Combatant** — `deal/pass/draw` only move cards between Cards
documents; there is no native `combatant.cards`. The Combat↔Cards initiative glue is custom —
prototype it early in Phase 8. `Combat` is subclassed to `DeadlandsCombat` whose `rollInitiative()`
deals cards instead of rolling 1d20; suit tiebreaker (♠>♥>♦>♣) via a numeric `sort` on `Combatant`.

## V13 → V14 breaking changes that affect us

- `ApplicationV2` is the sheet framework we use; legacy `extends Application` is **deprecated** in V14 (removal targeted for a later major, not gone in 14.x). ProseMirror, not TinyMCE.
- `ActiveEffect#origin` → `DocumentUUIDField` (was `StringField`); `EffectChangeData#mode` → typed field.
- `documentTypes` + `TypeDataModel` supersede `template.json` (**deprecated/merged** in V14, not deleted — we ship none).
- `SceneControlTool` — new V14 properties: `interaction`, `control`, `creation` (added in V14; the exact "required" status was not page-verified).

## New in V14 (relevant to us)

- **ActiveEffects expanded** — richer expiration (events, "until combat ends") and effects can alter
  the Token. Useful for wounds / Harrowed / Guts. Don't stack 8 AEs on one field — compute the
  cumulative wound penalty in `prepareDerivedData`.
- **Measured Templates → Scene Regions** — V14 removed the `MeasuredTemplate` data type (the first core
  Document type ever removed). Build any AoE (e.g. hex effects) on **Scene Regions** (`RegionDocument`),
  not `MeasuredTemplate`.

## Reference

Foundry V14 API: <https://foundryvtt.com/api/> · Community wiki: <https://foundryvtt.wiki/>
