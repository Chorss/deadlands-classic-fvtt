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
  "Item":  { "weapon": {}, "armor": {}, "gear": {}, "ammo": {}, "edge": {…}, "hindrance": {…},
             "hex": {…}, "miracle": {…}, "favor": {…}, "gizmo": {…} }  // htmlFields ["system.description"] on every {…}
}
```

Archetype-specific item types (`hex`, `miracle`, `favor`, `gizmo`) are declared statically here too —
`documentTypes` cannot be extended at runtime. Archetype manifests only register their data models and
sheets (e.g. `ItemRegistry.register({ id: "hex", … })` in `module/archetypes/huckster/manifest.mjs`).

## Registration (init hook)

```javascript
Hooks.once("init", () => {
  CONFIG.Actor.documentClass = DeadlandsActor;
  CONFIG.Item.documentClass  = DeadlandsItem;
  CONFIG.Actor.dataModels = ArchetypeRegistry.dataModels(); // { cowboy: CowboyModel, … }
  CONFIG.Item.dataModels  = ItemRegistry.dataModels();

  for (const def of ArchetypeRegistry.all()) {
    foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "deadlands-classic", def.sheetClass, {
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
  prepareBaseData() { /* runs before active effects — available but unused in this codebase */ }
  prepareDerivedData() { /* computed fields after effects — e.g. wind.max from Vigor+Spirit */ }
  static migrateData(source) { return super.migrateData(source); } // seed from day one (plan §8)
}
```

The real hierarchy is two-level: `CowboyDataModel extends BaseCharacterDataModel extends
TypeDataModel` — the shared schema above lives in `module/archetypes/_base/base-character-data.mjs`.
Overlays merge extra schema fields into that base inside `defineSchema()` via `OverlayRegistry`
(each overlay contributes `schemaFields()`); that is how Harrowed adds `system.harrowed.*` without
a new documentType.

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
    header: { template: "systems/deadlands-classic/templates/actor/parts/header.hbs" },
    tabs:   { template: "systems/deadlands-classic/templates/actor/parts/tabs.hbs" },
    traits: { template: "systems/deadlands-classic/templates/actor/parts/traits-tab.hbs" },
    combat: { template: "systems/deadlands-classic/templates/actor/parts/combat-tab.hbs" },
    gear:   { template: "systems/deadlands-classic/templates/actor/parts/gear-tab.hbs" },
    bio:    { template: "systems/deadlands-classic/templates/actor/parts/bio-tab.hbs" }
  };
  static TABS = {
    sheet: {
      tabs: [
        { id: "traits", group: "sheet", icon: "fas fa-dice-d20", label: "DEADLANDS.Sheet.Tab.Traits" },
        /* …one entry per content part (combat, gear, bio)… */
      ],
      initial: "traits"
    }
  };
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.tabs = this._prepareTabs("sheet"); // per-tab {active, cssClass} state
    return context;
  }
  async _preparePartContext(partId, context) {
    if (context.tabs?.[partId]) {
      context.tab = context.tabs[partId]; // per-tab state for the part's template
    }
    return context;
  }
  static #onRollTrait(event, target) { /* click handler */ }
}
```

Tab machinery: `header` + `tabs` are non-tab navigation parts, `static TABS` drives the nav,
`_prepareTabs("sheet")` builds tab state, `_preparePartContext` injects it per part. Live
implementation: `module/archetypes/_base/base-character-sheet.mjs`.

Registration: `foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "deadlands-classic", Sheet, { types:
["cowboy"], makeDefault: true })` (or `Actors.registerSheet`) in `init`.

### PARTS / TABS do not merge across the class hierarchy

`ApplicationV2` merges `static DEFAULT_OPTIONS` up the prototype chain, but `static PARTS` and
`static TABS` are plain static properties — a subclass that overrides them **replaces the whole
set** (this silently dropped the Harrowed tab on the Huckster/Shaman/Blessed/Mad Scientist sheets;
fixed in 0.3.3). Rules:

- A subclass that adds no parts overrides only `DEFAULT_OPTIONS` (which merges) and inherits
  `PARTS`/`TABS` untouched — see `module/archetypes/cowboy/sheet.mjs`.
- A subclass that adds a tab re-declares the **full** `PARTS`/`TABS` literal, splicing in shared
  exported descriptors (`HARROWED_SHEET_PART`, `HARROWED_SHEET_TAB` from
  `module/archetypes/_overlays/harrowed/sheet-tab.mjs`) — see `module/archetypes/huckster/sheet.mjs`
  (same in blessed/shaman/mad-scientist).

## Cards API

The runtime initiative deck does **not** use native `foundry.documents.Cards` at all — `ActionDeck`
(`module/core/cards/action-deck.mjs`) builds a plain 54-card array (`buildFullDeck()`, 52 + 2 Jokers)
and persists it as a Combat flag (`deckState`), precisely because of the missing Combatant bridge
below. A `Cards`-type compendium pack (`action-deck`) is declared in `system.json`, but the
initiative engine never consumes it. The **Fate Pot is NOT Cards** either — it is a world-level
`game.settings` entry of a small DataModel `{white, red, blue, legend}` (`config: false`), wrapped by
a `FatePot` class. Cards model unique cards, not fungible counters.

⚠ Cards has **no native bridge to Combat/Combatant** — `deal/pass/draw` only move cards between Cards
documents; there is no native `combatant.cards`. The Combat↔Cards initiative glue is custom (hence
the flag-based deck above). `Combat` is subclassed to `DeadlandsCombat` whose `rollInitiative()`
deals cards instead of rolling 1d20; suit tiebreaker (♠>♥>♦>♣) via a numeric `sort` on `Combatant`.

## Queries API (`User#query`) — GM-routed shared-state writes

The GM proxy (`module/core/gm-proxy.mjs`) uses Foundry's native Queries API to execute Fate Pot /
Action Deck mutations on the single active GM client. Facts below were verified against the local
Foundry **14.364** installation source (`client/documents/user.mjs`,
`client/documents/collections/users.mjs`, `common/constants.mjs`, server relay in
`dist/components/activity.mjs`):

- **Registration on every client.** `CONFIG.queries["<name>"] = handler` must run during `init` on
  *all* clients — `User#query` throws `User query '<name>' is not registered` on the **calling**
  client otherwise. Handlers execute only on the *target* user's client.
- **Caller:** `targetUser.query(name, data, { timeout })`. Requires the `QUERY_USER` permission
  (default role: PLAYER — all players have it). Throws if the target user is not active.
- **Handler signature:** `handler(queryData, { timeout, user })` — `user` is the *requesting* User
  document (usable for per-op permission gates). The return value travels back via socket ack, so
  request and response must be **JSON-serializable**. A handler exception reaches the caller as
  `new Error(reason)` — only the message string survives the wire, no stack/type.
- **Always pass a `timeout`.** Without one the server never expires the query and the caller's
  promise can hang forever (only a sender disconnect cleans it up).
- **No `"socket": true` needed** — queries ride the core `userQuery` socket channel; the manifest
  flag only gates the direct `system.<id>` namespace.
- **`game.users.activeGM`** designates one GM deterministically on every client (highest role,
  ties broken by id comparison) — safe to use as the single-writer target.
- ⚠ **Multi-tab caveat:** the server emits a query to *every* socket of the target user; a GM
  logged in from two tabs executes the handler twice (first ack wins, side effects double-apply).
  Multi-tab GM sessions are unsupported.
- **Self-dispatch:** a query to yourself round-trips the server — `dispatchGmOp` short-circuits
  the `activeGM.isSelf` case to a local handler call instead.

Server permissions this design works around (also verified in 14.364 source): world-scope
`game.settings.set` requires `SETTINGS_MODIFY` (default: ASSISTANT), and non-GM `Combat` updates
are whitelisted to `_id/round/turn/combatants` — `flags` writes from players are rejected.
`Combatant` flags, by contrast, *are* owner-writable (that's why `setHand` needs no proxy).

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
