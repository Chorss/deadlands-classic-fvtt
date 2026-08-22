# Implementation plan: Deadlands Classic — Community Edition for Foundry VTT v14+

> Architecture document and implementation roadmap for the system. Reference point for all contributors.

## Context

We are building a **game system** for Foundry VTT from scratch, supporting **Deadlands Classic 20th Anniversary Edition** (Weird West, 1876). The repository now holds a full working system (~65 `.mjs` files under `module/`, plus templates, styles, compendium packs, and unit tests). We have two reference projects in the repo under `vendor/` (`vendor/DeadlandsClassic/` — Dulux-Oz, newer; `vendor/Deadlands-Classic/` — RhombusWeasel, older v9) plus the original rulebook PDF (413 pages). We do not copy code from the references (different licenses, different assumptions), but we learn from their patterns.

**Why now, what for:** Previous attempts are abandoned or limited to older Foundry versions. We want a modern, community-developed system built on the V14+ API (TypeDataModel, ApplicationV2, documentTypes, ActiveEffect), released under MIT.

**End result:** A working system in Foundry V14+ that lets you run a Deadlands Classic session with support for: exploding dice (Aces), a dice pool with "take highest", card-based initiative (Action Deck), Fate Chips (4 colors), hit locations + wound levels + Wind, Arcane Backgrounds (Huckster, Blessed, Shaman, Mad Scientist), and Harrowed as an overlay. EN + PL from v0.1.

**Key architectural directive:** Plugin-style for archetypes — because later supplements (HoE, LC, Smith & Robards, Book o' the Dead, etc.) add new archetypes. The system core must be archetype-agnostic.

---

## 1. Architectural decisions (accepted)

| Decision | Choice | Reason |
|---|---|---|
| Foundry compatibility | **V14 minimum, V14 verified** (Node.js 24) | V13→V14 breaking changes (ApplicationV2, documentTypes, ActiveEffect fields) make V13 a dead end. |
| Code format | **ES Modules (.mjs)**, no bundler, no TS | Simplicity of the dev setup. JSDoc for public API types. |
| Data model | **TypeDataModel** per type, **documentTypes** in system.json | Zero `template.json`. Forced by V14. |
| Sheets | **ApplicationV2 + HandlebarsApplicationMixin** | TinyMCE removed in V14. ProseMirror + HBS is the current standard. |
| Game editions | **Deadlands Classic v1 only.** HoE/LC deferred to v2+. | Smaller MVP. README to be corrected. |
| PC actor types | **Separate type per archetype** + registry pattern | Each archetype = a self-contained module. |
| Harrowed | **Overlay (flag + sub-schema)**, not a separate actor type | `dlc` p.194 (Harrowed chapter): any PC can become Harrowed — an overlay laid over an ordinary character. |
| Combat automation | **Medium** | Auto: exploding dice, trait rolls, damage rolls, hit-location draw. Manual: spending Fate Chips, soak, final wound application. |
| Localization | **EN + PL from v0.1** | All code goes through `game.i18n` from the start. |
| License | **MIT** | A permissive license maximizes adoption in the Foundry ecosystem (MIT/Apache dominate — dnd5e, pf2e, most modules). Predecessors don't force GPL since we don't copy their code (RhombusWeasel is MIT anyway, Dulux-Oz is GPL-3.0 — but architectural patterns aren't subject to copyright). |
| Distribution | **GitHub Releases** + standard `system.json` manifest URL | Per the README. |

---

## 2. Architectural pillar: **Archetype Plugin Registry**

### Problem
Deadlands originally has 5 PC archetypes (Cowboy, Huckster, Shaman, Blessed, Mad Scientist) + the Harrowed overlay. Supplements introduce more (e.g., Martial Artist, Toxic Shaman, Cyborg in HoE). If we hardcode every archetype in core, every extension requires modifying core — bad.

### Solution: Registry Pattern

Each archetype = a **self-contained folder** with a manifest, data model, sheet, archetype-specific mechanics, templates, icons, and i18n keys. Core only knows the `ArchetypeDefinition` interface.

```
module/archetypes/
├── _base/                       # Shared base (per-archetype logic lives in each archetype's mechanics.mjs)
│   ├── base-character-data.mjs  # Traits, aptitudes, wounds, wind, chips, edges/hindrances
│   └── base-character-sheet.mjs # Shared sheet (tabs: Traits/Combat/Gear/Bio)
├── cowboy/
│   ├── manifest.mjs             # ArchetypeRegistry.register({...})
│   ├── data.mjs                 # CowboyDataModel extends BaseCharacterDataModel
│   ├── sheet.mjs                # CowboySheet extends BaseCharacterSheet
│   ├── templates/cowboy.hbs     # (or reuse base)
│   └── lang/{en,pl}.json        # Archetype-specific keys
├── huckster/
│   ├── manifest.mjs             # Registers the archetype + the hex item type
│   ├── data.mjs                 # + hexslingin' deck slot, backlash counter
│   ├── sheet.mjs                # + "Hexes" tab with a "Cast" button
│   ├── mechanics.mjs            # Cast-hex workflow: roll → draw → evaluate poker hand
│   └── templates/hexes-tab.hbs
├── shaman/
│   ├── manifest.mjs, data.mjs, sheet.mjs, mechanics.mjs (rituals/favors)
├── blessed/
│   ├── manifest.mjs, data.mjs, sheet.mjs, mechanics.mjs (miracles + sin tracking)
├── mad-scientist/
│   ├── manifest.mjs, data.mjs, sheet.mjs, mechanics.mjs (blueprint → reliability)
└── _overlays/
    └── harrowed/                # An overlay, not an archetype — applicable to any PC
        ├── manifest.mjs         # OverlayRegistry.register({...})
        ├── data-schema.mjs      # { isHarrowed, dominion, powers[], countingCoup }
        ├── sheet-tab.mjs        # Adds a "Harrowed" tab when isHarrowed=true
        └── mechanics.mjs        # Dominion roll (opposed Spirit + Dominion, per session)
```

### The ArchetypeDefinition interface (contract)

```javascript
// module/core/archetype-registry.mjs
export class ArchetypeRegistry {
  static #archetypes = new Map();

  /**
   * @param {{
   *   id: string,              // Matches documentTypes.Actor key
   *   label: string,           // i18n key
   *   dataModel: typeof foundry.abstract.TypeDataModel,
   *   sheetClass: typeof foundry.applications.sheets.ActorSheetV2,
   *   mechanics?: object,      // Optional — callbacks for special rolls
   *   defaultIcon: string,
   *   htmlFields?: string[]    // For system.json documentTypes
   * }} def
   */
  static register(def) { ... }
  static get(id) { ... }
  static all() { return [...this.#archetypes.values()]; }
  static dataModels() { /* → { cowboy: CowboyDataModel, ... } */ }
}
```

### Adding a new archetype = 3 steps
1. Create the folder `module/archetypes/<id>/` with `manifest.mjs`, `data.mjs`, `sheet.mjs`
2. Add a single import line in `deadlands-classic.mjs`
3. Add an entry to `system.json → documentTypes.Actor`

**No need to touch:** rolls, cards, chips, wounds, Wind, edges/hindrances — all of those mechanics live in `core/` and operate on the base schema. A new archetype inherits everything automatically.

---

## 3. System core (core/) — archetype-agnostic

### 3.1 Dice Engine (`core/dice/`)
- **`exploding-roll.mjs`** — a helper `rollExplodingDicePool(dieCount, dieType, {modifier, tn})` returning `{total, highest, dice[], aces, bust, raises}`. Uses native Foundry `xo` (open-ended explosion) + postprocessing for "bust" (more 1s than successes) and "raises" (`floor((highest - tn) / 5)`).
- **`trait-roll.mjs`** — a wrapper around exploding-roll that renders a ChatMessage with [Spend Fate Chip] [Reroll] buttons.
- **`damage-roll.mjs`** — handles the `"3d6+2"` format with explosion, integrates with armor reduction.

### 3.2 Action Deck (`core/cards/`)
- We use **native `foundry.documents.Cards`** (type `deck`) — that's the only legitimate use of Cards (unique cards); the chip pool no longer (see §3.3, decision D2).
- **Note (risk, §8):** the Cards API has **no** native link to the combat tracker / combatant initiative (`deal/pass/draw` work only between Cards documents). We write the Combat↔Cards bridge ourselves — **prototype it early in Phase 8** (one combatant → one card → `Combatant#initiative`) before building the tracker UI; fallback: a custom deck object.
- A preset 54-card deck (52 + 2 jokers) is available as the compendium pack `packs/action-deck/`.
- The `ActionDeck` class wraps Cards — methods: `dealInitiative(combatant, count)`, `burnCard(combatant)`, `shuffleDiscards()`, `drawForHuckster(huckster, count)`.
- Integration with the Foundry Combat tracker: `DeadlandsCombat extends Combat`, overrides `rollInitiative()` to deal cards instead of rolling a d20. Black Joker: the **Marshal** (not the player) draws a chip from the pool + the player discards their "up the sleeve" card + a reshuffle at the end of the round (`dlc` p.118).

### 3.3 Fate Pot & Chips (`core/chips/`)
- **Fate Pot = a world-level setting** (`game.settings.register`, `scope: "world"`) holding 4 integers `{white, red, blue, legend}` (decision D2, §8). The pool is **fungible counters**, not a deck of cards — the `Cards` API is for unique cards and stays with the Action Deck (§3.2). **Zero `documentTypes`, zero document-type migration, no `fate-pot` pack.** Implementation (verified vs Foundry 14.364): a single setting of type **DataModel** `{white,red,blue,legend}` (type-safe — `game.settings.register` accepts a DataModel as `type`), `config: false` (hidden in the settings UI), registered in the `init` hook.
- Starting pot: 50×White, 25×Red, 10×Blue, 0×Legend (Legend grows only by being earned). Confirmed: `dlc` p.145 (PL `pg-pl` p.143 → "50 white, 25 red, 10 blue").
- The `FatePot` class (`core/chips/fate-pot.mjs`) — a pure-logic API: `drawBlind(n)` (a weighted random pick from the pool), `returnToPool(color, n)`, `reset()`. Testable in `chip-rules.test.mjs` without Foundry. An optional admin dialog for the GM (pool preview/correction).
- **Player** chips live on the actor (`system.chips.{white,red,blue,legend}` as integers) — independent of the pool.
- On the sheet: a chip widget with counters + `spend-white/red/blue/legend` buttons and "+/−" (grant/subtract; "grant" may draw from the pool).
- Rules per `dlc` p.146-148 (checked directly):
  - **White:** +1 extra die on a Trait/Aptitude roll (as many as you like up to the first red/blue/legend). Negates 1 wound OR 5 Wind. 1 Bounty Point.
  - **Red:** roll **one bonus die** and add its result to the highest die (NOT a flat +1). Max 1/action. **Marshal's Tithe** — the Marshal draws a chip from the pool when a player uses a red on a roll. Negates 2 wounds OR 10 Wind. 2 BP.
  - **Blue:** like red, but without Marshal's Tithe. Max 1/action. 3 wounds / 15 Wind. 3 BP.
  - **Legend:** use it **as a blue OR as a Reroll** of the whole roll (alternatively, not cumulatively); the reroll permanently consumes the chip and is the only way to redo a bust. 5 wounds / all Wind. 5 BP.
  - **Going Bust** — you can't spend white/red/blue; only Legend (as a reroll) lets you redo a bust.
  - **Limit of 10 chips** — the surplus is converted to Bounty Points.

### 3.4 Wounds & Wind (`core/wounds/`)
- **Hit-location table** (`dlc` p.133, `1d20` roll): `1–4` Legs, `5–9` Lower Guts, `10` Gizzards, `11–14` Arms, `15–19` Upper Guts, `20` Noggin. L/R sub-roll: **any die**, even = right / odd = left (NOT `1d2`). Splitting the limbs into L/R yields **8 slots** of the wound track (a design decision, not a number taken directly from the table): Noggin, Upper Guts, Lower Guts, Gizzards, Left/Right Arm, Left/Right Leg.
- **Severity levels** per the Wound Severity table `dlc` **p.139** (the character sheet p.412-413 repeats the Wound Key): Light (1) → Heavy (2) → Serious (3) → Critical (4) → Maimed (5). Each location has a `severity: 0-5` slot.
- `HitLocationTable` — a RollTable in a compendium, `1d20` → location (+ a sub-roll with any die, odd/even, for arms/legs).
- **Raises = location adjust** (`dlc` p.133): the attacker may shift the result by ±1 per raise — implemented via a "Called Shot / Raise Adjust" dialog after the damage roll.
- **Wind** — a single counter (fields `system.wind.value` / `system.wind.max` — consistent with the manifest's `primaryTokenAttribute: "wind.value"` and the Foundry idiom for resource bars `{value, max}`), max computed in `prepareDerivedData` as `Vigor.die + Spirit.die` in face values (d6=6, d8=8, etc.) — `dlc` p.40.
- The cumulative penalty from the sum of wound severities is computed in `prepareDerivedData` (code, not 8 independent AEs — §8 R9). Maimed = the location is unusable, as a separate state/flag (arm = can't use that hand, leg = halved pace).

### 3.5 Core Item Types (`core/items/`)
- `weapon` — `rangeType (melee|ranged)`, `shots`, `rof`, `range`, `damage`, `ammoType`, `defense` (for melee)
- `armor` — `location[]`, `armorValue` (die-type reduction — per the PDF armor rule on p.134)
- `gear` — an ordinary item: `price`, `weight`, `quantity`
- `edge` — `cost`, `category`, `requirements[]`, `effects[]` (ActiveEffects)
- `hindrance` — `value` (points gained), `category`, `effects[]`
- `ammo` — tied to `ammoType`, tracked on the sheet (Ammo One/Two/Three as on the original sheet)

### 3.6 Archetype-specific item types (data models in `core/items/`)
- `hex` (Huckster) — `hand` (min poker hand), `trait`, `speed`, `duration`, `range`, `effect`
- `miracle` (Blessed) — `tn`, `speed`, `duration`, `range`, `effect`, `sinSeverity`
- `favor` (Shaman) — `appeasement`, `ritualType[]`, `duration`, `range`, `effect`
- `gizmo` (Mad Scientist) — `theoryText`, `blueprintHand`, `constructionTN`, `reliability`, `malfunctionEffect`

The data models for these types live in `module/core/items/*.mjs` (`hex-data.mjs`, `miracle-data.mjs`, `favor-data.mjs`, `gizmo-data.mjs`); each archetype's manifest registers its type through `ItemRegistry`, while the `documentTypes` entries are declared statically in `system.json`.

---

## 4. Directory structure (final)

```
deadlands-classic-fvtt/
├── system.json                          # manifest (documentTypes in sync with registries)
├── module/
│   ├── deadlands-classic.mjs            # Entry — imports + init hook
│   ├── core/
│   │   ├── archetype-registry.mjs
│   │   ├── item-registry.mjs
│   │   ├── overlay-registry.mjs         # Harrowed & future overlays
│   │   ├── config.mjs                   # DEADLANDS config obj (constants)
│   │   ├── utils.mjs                    # Shared helpers (toPascal, …)
│   │   ├── async-queue.mjs              # KeyedAsyncQueue — Fate Pot / Action Deck mutex
│   │   ├── font-settings.mjs            # Display-font picker (system setting)
│   │   ├── dice/
│   │   │   ├── exploding-roll.mjs
│   │   │   ├── trait-roll.mjs
│   │   │   ├── damage-roll.mjs
│   │   │   ├── guts-check.mjs
│   │   │   └── poker-hand-evaluator.mjs
│   │   ├── cards/
│   │   │   ├── action-deck.mjs
│   │   │   ├── combatant-hand-dialog.mjs
│   │   │   ├── deadlands-combat.mjs     # Overrides Combat
│   │   │   └── deadlands-combatant.mjs
│   │   ├── chips/
│   │   │   ├── fate-pot.mjs
│   │   │   ├── chip-widget.mjs          # UI component
│   │   │   └── chip-rules.mjs           # Validation: 1/action for red/blue, etc.
│   │   ├── wounds/
│   │   │   ├── wound-track.mjs
│   │   │   ├── hit-location.mjs
│   │   │   └── wind-calculator.mjs
│   │   ├── documents/                   # Core doc overrides
│   │   │   ├── deadlands-actor.mjs
│   │   │   └── deadlands-item.mjs
│   │   └── items/                       # Item-type data models
│   │       ├── core-items-manifest.mjs  # Registers weapon/armor/gear/ammo
│   │       ├── edge-data.mjs
│   │       ├── hindrance-data.mjs
│   │       ├── hex-data.mjs
│   │       ├── miracle-data.mjs
│   │       ├── favor-data.mjs
│   │       └── gizmo-data.mjs
│   └── archetypes/
│       ├── _base/
│       │   ├── base-character-data.mjs
│       │   └── base-character-sheet.mjs
│       ├── cowboy/
│       ├── huckster/
│       ├── shaman/
│       ├── blessed/
│       ├── mad-scientist/
│       ├── _overlays/harrowed/
│       ├── npc/                         # GM-controlled full NPC
│       └── mook/                        # Simplified grunt
├── templates/
│   ├── actor/                           # Base + per-archetype overrides
│   │   ├── parts/                       # Reusable HBS partials (traits, aptitudes, chips, wounds)
│   │   └── …
│   ├── item/
│   └── dialogs/
├── styles/
│   ├── deadlands-classic.css            # Entry — @import of modules
│   ├── _variables.css                   # CSS custom properties (theme)
│   ├── _base.css
│   ├── actor-sheet.css
│   ├── item-sheet.css
│   ├── chips.css
│   ├── combat.css
│   └── archetypes/                      # Styles per archetype (hex-tab, miracle-tab, etc.)
├── lang/
│   ├── en.json
│   └── pl.json
├── packs/                               # Compendium packs (V14 LevelDB; built from packs/_source/ via `fvtt package pack`)
│   ├── _source/                         # Source JSON per pack (source of truth; .gitignore must have !packs/_source/)
│   ├── action-deck/                     # 54-card preset deck (Fate Pot is NOT a pack — it's a world setting, §3.3)
│   ├── edges-srd/                       # Edge names + mechanical effects (no flavor copy)
│   ├── hindrances-srd/
│   ├── hexes-srd/                       # Example hexes (mechanics only, no flavor copy)
│   ├── hit-location/                    # RollTable
│   └── archetype-examples/              # Example NPCs, one per archetype
├── icons/                               # SVG (cards, chips, wound severity, archetype icons)
├── docs/
│   ├── notes.md                         # (exists)
│   ├── implementation-plan.md           # THIS file
│   ├── architecture.md                  # registry pattern + contract (exists; diagram + SemVer in Phase 14)
│   ├── v14-api-notes.md                 # V14 patterns (exists)
│   ├── mechanics-reference.md           # mechanics paraphrase + page citations (exists)
│   ├── extending-archetypes.md          # How to add a new archetype
│   └── migration-policy.md              # World-data migration policy
├── tools/
│   ├── verify-documenttypes.mjs         # Sanity-check script: documentTypes == registered archetypes
│   └── audit-css.mjs                    # dlc-* class coverage audit (templates ↔ styles)
├── .github/
└── CHANGELOG.md, README.md, CONTRIBUTING.md, LICENSE, SECURITY.md, CODE_OF_CONDUCT.md
```

---

## 5. Phased plan — incremental, one file at a time

**Every phase below is closed.** The headings and one-line scopes are kept as the historical
skeleton — the per-phase file lists and acceptance tests they used to carry were removed once the
work shipped, because `CHANGELOG.md` is the accurate record of what each release actually
contained. Release mapping is in §10; work still open after 0.4.0 is in §12.

### Phase 0 — Repo configuration, metadata, and AI workshop
**Closed** — pre-0.1.0. Manifest, licensing (GPL-3.0 → MIT), Biome, git hooks, CI, and the
Claude Code workshop (`CLAUDE.md`, `.claude/rules/`, skills, subagents, `.mcp.json`).

### Phase 1 — Core foundations: config + registries
**Closed** — 0.1.0. `config.mjs` constants plus the three registries (archetype, item, overlay)
and the `DeadlandsActor` / `DeadlandsItem` document subclasses.

### Phase 2 — Base character data + sheet
**Closed** — 0.1.0. `BaseCharacterDataModel` (traits, aptitudes, wounds, Wind, chips) and the
Cowboy sheet on ApplicationV2, with `migrationVersion` in place from the start.

### Phase 3 — Core dice engine
**Closed** — 0.1.0. Exploding trait/aptitude rolls, damage rolls, and raise counting as pure,
unit-tested modules.

### Phase 4 — Actor sheet ↔ dice integration
**Closed** — 0.1.0. Click-to-roll from the sheet through the roll dialog to a chat card.

### Phase 5 — Fate Pot & chip system
**Closed** — 0.1.0. The world-setting Fate Pot, the chip widget, and the spend rules
(1/action, bust block, "No Going Back").

### Phase 6 — Wounds, wind, hit locations
**Closed** — 0.1.0. The 8-location wound track with severity accumulation, the maimed state,
Wind, and hit-location draws.

### Phase 6A — Guts / fear checks
**Closed** — 0.1.0. Guts rolls against Fear Levels, the Terror table, and Scart — the horror
core, and the marker for the playable 0.0.x preview.

### Phase 7 — NPC + Mook archetypes
**Closed** — 0.1.0. Two GM-facing actor types on compact sheets.

### Phase 8 — Action Deck & Combat
**Closed** — 0.1.0. Card initiative: `DeadlandsCombat` deals from a 54-card deck held as a
Combat flag, with the combatant hand dialog and suit tiebreakers.

### Phase 9 — Huckster archetype + hexes
**Closed** — 0.1.0. The `hex` item type, the poker-hand evaluator, and the cast-hex flow
including backlash.

### Phase 10 — Blessed + Shaman + Mad Scientist
**Closed** — 0.1.0. Three arcane archetypes with their `miracle` / `favor` / `gizmo` item types
and their sin, ritual, and madness tables.

### Phase 11 — Harrowed overlay
**Closed** — 0.2.0. `OverlayRegistry` plus the conditional Harrowed sheet tab and the nightly
Dominion roll — the pattern proof that an overlay is not an archetype.

### Phase 12 — Edges, Hindrances, Aptitudes content packs
**Closed** — 0.2.0. The `edges-srd`, `hindrances-srd`, `hexes-srd`, `hit-location` and
`archetype-examples` packs, built from `packs/_source/` via the `fvtt` CLI. Coverage is partial —
see §12.

### Phase 13 — Localization completion (full EN/PL)
**Closed** — 0.3.0. Full EN/PL key parity with PL terminology from the MAG translations, enforced
by `tools/verify-documenttypes.mjs`.

### Phase 14 — Polish, release, CI
**Closed** — delivered across 0.1.0-0.3.0: `.github/workflows/ci.yml` in 0.1.0, tooling and docs
in 0.2.0, the accessibility pass in 0.3.0.

---

## 6. Important files to modify/create (list)

**Exists in the repo after Phase 0.A (done ✅):**
- `system.json` ✅ — V14 + `type: "system"` + `documentTypes` (7 actors, 6 items at the time; now 7 actors, 10 items — `hex/miracle/favor/gizmo` added in Phases 9-10) + esmodules/styles/languages/empty packs
- `README.md` ✅ — V14-only, Classic-only v1, feature list with Legend chip/Mad Scientist/Harrowed, 8 locations, MIT badge
- `.gitignore` ✅ — added `.claude/settings.local.json`, `.claude/cache/`, `.claude/logs/`
- `lang/en.json` + `lang/pl.json` ✅ — 15 paired starting keys
- `module/deadlands-classic.mjs` ✅ — a stub with init/ready hooks + `game.deadlandsClassic`
- `styles/deadlands-classic.css` ✅ — an entry with commented-out imports (TODO Phases 2-5)
- `LICENSE` + metadata ✅ — MIT (migrated from GPL-3.0 during Phase 0.A)

**Exists in the repo after Phase 0.B essentials (done ✅):**
- `CLAUDE.md` ✅ (root)
- `.claude/settings.json` ✅ — permissions (**20 allow** / 8 deny), env `DEADLANDS_DEV=1`, hooks SessionStart (git hooksPath) + PostToolUse (`Write|Edit|MultiEdit` → syntax/JSON/lang; `Bash` → `post-extract-verify.sh`)
- `.claude/settings.local.json` ✅ — user-specific (`DEADLANDS_RULES_PATH`, ad-hoc WebFetch domains, Read globs to `deadlands-rules-ref`); gitignored, content varies per developer
- `.claude/hooks/post-write.sh` ✅ (dispatcher by extension) + `.claude/hooks/post-extract-verify.sh` ✅ (PDF-extract quality gate)
- `.claude/commands/verify-system.md` ✅ + `.claude/commands/release.md` ✅ (the `/release` skill)
- `.claude/agents/pdf-reference-lookup.md` ✅
- `.claude/rules/` ✅ — 5 files (commits, naming, v14-api, localization, references) with `paths:` auto-scope
- `.mcp.json` ✅ — Playwright + context7 (project-scoped, requires approval on first start)
- `.githooks/pre-commit` ✅ + `.githooks/commit-msg` ✅
- `tools/verify-documenttypes.mjs` ✅ (MVP — without the registry comparison, added since Phase 1)
- `tests/smoke.test.mjs` + `tests/.gitkeep` ✅
- `package.json` ✅ + `biome.json` ✅ + `.editorconfig` ✅
- `.gitignore` ✅ — Claude + Playwright artifacts (`test-results/`, `playwright-report/`, `.playwright/`)
- Memory: `architecture.md` ✅ (new), `dev_workflow.md` ✅ (new), update `game_mechanics.md` + `v14_api_notes.md`, `MEMORY.md` index extended

**Phase 0.B nice-to-have — current state:**
- Done ✅: `/add-archetype`, `/new-phase`, the `archetype-scaffolder` subagent, the `foundry-v14-checker` subagent, `.github/workflows/ci.yml`
- Still open ⏳ (no real need arose): `/add-item-type`, `/pdf`, `/phase-test`, `/foundry-link`, the `foundry-test-runner` subagent, `docs/claude-workflow.md`

**Created in later phases (✅ all exist now):**
- System code (Phases 1-13): `module/core/`, `module/archetypes/`, `templates/`, `styles/*.css`, the compendium `packs/` (action-deck, archetype-examples, edges-srd, hexes-srd, hindrances-srd, hit-location; + `packs/_source/` and the `fvtt package pack` build), the unit tests. (`module/ui/` was never created and never will be — the widgets live in `module/core/`, e.g. `core/chips/chip-widget.mjs`.)
- Docs (Phase 14): `docs/extending-archetypes.md` ✅, `docs/migration-policy.md` ✅ (`docs/architecture.md`, `v14-api-notes.md`, `mechanics-reference.md` existed earlier)
- CI: `.github/workflows/ci.yml` ✅ (shipped in 0.1.0)

**Created outside the original plan (✅, reconciled in §5 Phase 14):**
- `.github/workflows/release.yml` ✅ — the full tag→ZIP→Release workflow (originally planned for Phase 14)
- `.claude/rules/rulebook-authority.md` ✅ + the `.claude/skills/verify-mechanic/` skill ✅ + the `.claude/agents/mechanic-verifier.md` subagent ✅ + a post-write reminder on mechanics files — they enforce "mechanics only from the `deadlands-rules-ref` source" (a workshop response to paraphrase drift from the 2026-06-17 audit; the mechanisms confirmed vs the Claude Code docs via context7 + the guide)

---

## 7. Technical patterns and principles (dev style)

- **No bundler** — `.mjs` directly. `import ... from "./foo.mjs"` with the `.mjs` extension.
- **No backwards-compat shims** — V14-only, we don't pretend to be the V13 API.
- **JSDoc types** for the public core APIs — especially `ArchetypeDefinition`, `TraitRollOptions`, `ChipSpendContext`.
- **Hook naming:** `deadlandsClassic.preTraitRoll`, `deadlandsClassic.chipSpent`, `deadlandsClassic.woundApplied`. Lets modders hook in without forking.
- **Game object namespace:** `game.deadlandsClassic = { archetypes, items, overlays, dice, cards, chips, wounds, config }` — a single entry point to the system's API.
- **CSS** — CSS custom properties in `_variables.css` for a consistent theme (a Western palette — sepia, black accents, red chips).
- **Icons** — SVG where possible (cards, chips). Bitmaps only where we must (background, portraits).
- **Commit style** — conventional commits. `feat:`, `fix:`, `docs:`, `chore:`. Branch-per-feature, PRs with the template from `.github/`. Full rules in `.claude/rules/commits.md` (enforced by `.githooks/commit-msg`).
- **Naming convention** — documentType keys in `system.json` and registry keys use `camelCase` (e.g. `madScientist`). Folders and files use `kebab-case` (e.g. `module/archetypes/mad-scientist/data.mjs`). i18n keys — `PascalCase` segments (e.g. `DEADLANDS.Archetype.MadScientist.Label`). JS classes — `PascalCase` (e.g. `MadScientistDataModel`). Constants — `SCREAMING_SNAKE_CASE` in `config.mjs`.
- **ApplicationV2 paths (V14)** — `foundry.applications.api.ApplicationV2`, `foundry.applications.api.HandlebarsApplicationMixin`, `foundry.applications.sheets.ActorSheetV2`, `foundry.applications.sheets.ItemSheetV2`. **✅ Verified vs Foundry 14.364** (context7/wiki, 2026-06-17 audit): the pattern `class S extends HandlebarsApplicationMixin(ActorSheetV2)`; per-type registration via `DocumentSheetConfig.registerSheet(Actor, "deadlands-classic", Sheet, { types: ["cowboy"], makeDefault })` in the `init` hook. At the next V14.x minor, check again in case something shifts.
- **V14 novelties relevant to the project (vs 14.364):** ActiveEffects have extended expiration (expiration events, "until the end of combat" effects) and can modify the Token — beneficial for wounds / Harrowed (dominion per session) / Guts, but watch out for aggregation (§8 R9). Measured Templates replaced by **Scene Regions** (`RegionDocument`, the first removed fundamental V14 data structure) — any AoE (e.g. hexes) should be built on Scene Regions, not `MeasuredTemplate`.
- **Hook deadlock protection** — the PostToolUse hooks fire `node --check` / verify; if a hook times out or hangs, save the diagnostics and avoid recursive edits within a single hook callback.
- **Test layers** — a clear split so as not to confuse the tools:
  - **Pure logic** (`module/core/dice`, `chips`, `wounds`, `cards`) → `node:test` in `tests/`. No Foundry, no browser. Fast.
  - **Foundry integration** (sheet render, document CRUD, hooks) → Playwright MCP in a headed browser with Foundry running on `localhost:30000`. A dedicated dev world (e.g. `deadlands-dev`) with a system symlink.
  - **API lookup / documentation** → context7 MCP for libraries (Foundry V14, ProseMirror, Biome), the `pdf-reference-lookup` subagent for rulebook mechanics.

---

## 8. Risks and open questions

> Register updated after the **2026-06-17** audit (5 parallel tracks: plan quality, risk completeness, plan↔repo, mechanics↔PDF, source currency). Some original risks aimed at the wrong target — re-targeted; missing ones added. L×I = Likelihood × Impact (H/M/L).

### Risks — register

| Risk | L×I | Mitigation / status |
|---|---|---|
| **"Deadlands" trademark** — the PEG Fan License **explicitly excludes** the Deadlands setting (SWAG too); MIT protects the code, not the brand. This is NOT the same as prose copyright. | M×H | **CONSCIOUSLY ACCEPTED (D1).** `deadlands-classic` + a disclaimer "unofficial / not affiliated" (README, present). The risk = C&D/takedown, not damages. The `id` is practically irreversible after a public release — **at the 1st public Release, reconsider** (possibly an email to PEG). Source: shop.peginc.com/pages/licensing. |
| **No world-data migration** — 0.1→0.2→0.3 changes the `TypeDataModel` schema; without `migrationVersion` an update breaks existing worlds. | H×H | `static migrateData()` per model + `migrationVersion` (world settings) since Phase 2; a guarded runner in `ready`; `docs/migration-policy.md` + `tests/migration.test.mjs` (Phase 14). |
| **The Cards API doesn't support initiative** — `deal/pass/draw` only between Cards documents; no bridge to Combat/Combatant. Card-initiative (Phase 8) stands on its own glue. | M×H | Prototype Combat↔Cards **early in Phase 8** before the tracker UI; fallback: a custom deck object. Source: foundryvtt.com/api Cards. |
| **CI can't run Foundry** — a commercial license: the binaries may not be committed, the key = the owner's secret; external PRs won't run E2E. | H×M | CI only license-free (lint, `node --test`, `verify-documenttypes`); Playwright E2E = **locally**, not a PR gate (`npm run test:e2e`). Documented in `docs/testing-e2e.md`. Source: foundryvtt.com/article/license. |
| **No pack-build tooling** — V14 packs = LevelDB built by `fvtt package pack` from JSON; `*.db/` is legacy NeDB. Phases 5/8/9/12 depend on a non-existent step. | H×M | `packs/_source/<slug>/*.json` → `fvtt package pack`; `@foundryvtt/foundryvtt-cli` dev-dep + an npm script; `.gitignore` → `!packs/_source/`. Source: github.com/foundryvtt/foundryvtt-cli. |
| **No SemVer for the registry contract** — extension modules bind to `*Registry` + the `deadlandsClassic.*` hooks + `game.deadlandsClassic`. A silent signature change breaks all of them. | M×H | Document it as a stable API (`docs/architecture.md`), SemVer (breaking = major), a deprecation window, a versioned `ArchetypeDefinition`. |
| **Bus factor (1 maintainer)** — 14 phases, ~28-35+ sessions; the Context notes that previous Deadlands attempts were abandoned. | M×H | Trim the MVP (a 0.0.x preview after Phase 6A — D3); `CONTRIBUTING.md` for non-Claude; a system runnable without the AI workshop. |
| **Dependency on the private `deadlands-rules-ref`** — a contributor without `$DEADLANDS_RULES_PATH` can't verify mechanics or the PDF hooks. | M×M | Page numbers in code comments / a committed prose-free citation map; the scripts/hooks degrade cleanly when the variable is unset. |
| **Wound ActiveEffect aggregation** — 8 locations × AEs mutating one `system.modifier` + edge/hindrance AEs: order/stacking sensitive. (A real risk instead of "chip widget performance".) | M×M | The cumulative penalty in `prepareDerivedData` (code), not 8 independent AEs; extend `wound-track.test.mjs` with AE interaction. |
| **Poker evaluator edge cases** — Royal Flush, jokers as wildcards. | L×M | Pure-logic unit tests `tests/poker-evaluator.test.mjs` (without Foundry). |
| **Harrowed overlay** — will it add cleanly? | L×M | Prototype early (Phase 11); fallback: a separate actor type. |
| **Ecosystem compatibility** — Dice So Nice (custom `xo` explosion), combat HUD vs the custom `DeadlandsCombat`. | M×M | Emit standard `Roll`s (DSN catches hooks); test with DSN + 1 combat-HUD before 0.2.0; known incompatibilities in the README. |
| **ProseMirror sanitization** — `system.biography`/`description` as `htmlFields`; raw HTML in a shared world = stored XSS. | L×M | Only `TextEditor.enrichHTML`; never raw `innerHTML` from user fields; a note in `SECURITY.md`. |
| **i18n parity drift** — across 14 phases the EN/PL keys diverge; the hook catches only `lang/*` edits. | M×L | A hard CI gate on key mismatch + missing `localize()`. |
| **Dynamic eval in dice/poker** — `damage-roll` parses formulas; a user-supplied string to `eval/Function` = injection. | L×M | Only the `Roll` API + validation; a `security-review` on `core/dice/` before release. |
| **No "definition of done" / a11y** — §9 has a scenario, but no "shippable" criterion, playtest, or a11y. | M×L | A DoD checklist per release + 1 real playtest; an a11y pass (contrast, keyboard, `aria-label`) in Phase 14. |
| **Archetypes from supplements** (HoE/LC different aptitudes). | L×L | The registry pattern is ready; supplements as separate modules `deadlands-hoe-expansion`. |
| **Foundry V14.x minor breaks.** **Good news: V14 is GA** (stable since 14.359, April 2026; latest 14.364). | L×M | Pin `compatibility.verified` to a **specific build** (e.g. `14.364`), not bare `"14"`; stable ApplicationV2 API. Source: foundryvtt.com/releases/14.359. |

### Resolved decisions (2026-06-17 audit)
- **D1 — name/`id`:** stays `deadlands-classic` + disclaimer; the trademark risk is consciously accepted.
- **D2 — Fate Pot storage:** a **world-level setting** (`game.settings`, 4 integers) + the `FatePot` class — NOT `Cards`, NOT Actor. Zero `documentTypes`, zero migration, pure-logic testable. (Updates §3.3 / Phase 5 / §4.)
- **D3 — scope of 0.1:** Phases 0-7 (no arcana) + a **0.0.x preview** milestone after Phase 6A (Cowboy + dice + chips + wounds + Guts) for playtesting.
- **Action deck:** native `Cards` (type `deck`) — confirmed, but we write the bridge to Combat ourselves (see the Cards API risk).

### Open questions (to resolve during implementation)
- **Edges/hindrances — AE or flags?** A hybrid: a simple bonus ("Nerves o' Steel +1 Guts") via an AE; a complex one ("Level-Headed draw an extra card") via the `deadlandsClassic.initiativeDraw` hook.
- **Aptitudes — flat or nested?** Each has a governing trait → nested `{ [traitId]: { aptitudes: {...} } }` preferred. (A change after 0.1 = migration — see the migration risk.)
- **Wound-location widget layout** — `dlc` p.133 gives 8 slots; the sheet (p.412-413) may group them differently. Verify in Phase 6 before `wound-locations-widget.hbs`.
- **Raise → hit-location adjust** (`dlc` p.133) — a dialog after the roll vs a button in chat vs auto. Recommendation: a dialog before applying the wound, with a location preview.

---

## 9. Verification — how to test that it works

**Per phase:** specific tests described above.

**End-to-end test (after phase 12):** the "Posse starts a fight" scenario:
1. The GM creates a Deadlands Classic v14 system world.
2. Imports 4 PCs from the example compendium (1× Cowboy, 1× Huckster, 1× Shaman, 1× Blessed).
3. Hands out Fate Chips (3 per PC) — the "Draw Fate" command.
4. Starts combat (`/combat`) — the system deals cards (a Quickness roll vs TN 5 → 1 card + 1 per success and raise, max 5).
5. Round 1 — everyone plays cards; the Huckster uses a Mad Trick with a Black Joker → a Backlash test.
6. Round 2 — the Cowboy fires a peacemaker: a shootin' roll (Deftness die), a success with raises → a damage roll (3d6 explode), a location roll (1d20 → right leg), apply a Serious wound.
7. The wounded PC spends a Red Chip → negate 2 wounds. The Marshal draws a chip (tithe).
8. The Shaman performs a Dance ritual (Nimbleness) → gains 3 Appeasement → spends on "Strength of the Bear".
9. The Blessed tries Lay On Hands on the wounded one → a Faith roll vs. TN.
10. End of round, reshuffle if needed.

If the whole scenario passes without manual hacking — v0.1 is ready.

**Unit tests (node test runner):**
- `tests/exploding-roll.test.mjs` — check the extremes: all 1s = bust, all max with explosion, raises calculation.
- `tests/poker-evaluator.test.mjs` — 10 poker hands, jokers wild.
- `tests/wound-track.test.mjs` — severity accumulation, the maimed state.
- `tests/chip-rules.test.mjs` — the 1/action limit, bust-block, over-limit → bounty conversion.

**E2E tests (Playwright MCP, from Phase 2 once a sheet exists):**
- Opening an actor sheet per archetype — all tabs render, the ProseMirror editor works in the bio field, a trait change saves.
- Trait roll flow — click a trait → dialog → send → a chat message with the correct result.
- Chip spend flow — spending a white/red/blue chip modifies the roll and decrements the counter in the sheet.
- i18n switch — switching the language to `pl` swaps all visible strings (no `DEADLANDS.*` keys in the DOM).

---

## 10. Roadmap in release terms

| Version | Content | ETA (from a 0-files perspective) |
|---|---|---|
| **0.0.x (preview)** | Phases 0-6A: Cowboy + dice + Fate Pot/chips + wounds/wind + Guts — a playable vertical slice for playtesting (D3) | after Phase 6A |
| **0.1.0** | Phases 0-7 (core system, all base archetypes, Guts, no arcana) | ~28-35 coding sessions¹ |
| **0.2.0** | Phases 8-12 (action deck, arcana, overlay, content packs) | +22-28 sessions |
| **0.3.0** | Polish, CI, docs (phase 14), playtest fixes | +5 sessions |
| **0.3.1** | Offline display-font picker, full CSS layer, `tools/audit-css.mjs` | shipped 2026-06-30 |
| **0.3.2** | Release-tooling fixes (Biome format of `system.json`, `biome check` in pre-commit) | shipped 2026-07-01 |
| **0.3.3** | Bug-audit hotfixes (Dominion Roll, stale chip-spend + race conditions, guts wound-pool, Harrowed tab) | shipped 2026-07-01 |
| **1.0.0** | Stable, a 3-month bug-hunt, full PL localization (MAG canon) | +X |
| **1.x** | Classic supplements (Smith & Robards, Book o' the Dead, etc.) as separate modules |
| **2.0** | Hell on Earth Classic as a separate fork or module |

¹ Corrected after the audit (originally 20-25): Phase 8 (overriding `Combat`/the tracker in ApplicationV2) is realistically 4-6 sessions on its own; ≥5 open decisions require spikes. The estimate is a lower bound.

**Consciously out of scope for 0.1 (a declaration, not an oversight — 2026-06-17 audit):** character generation / point-buy (manual field editing in 0.1), spending Bounty Points + advancement/XP (in 0.1 BP is just chip income), encumbrance, mounts/vehicles, Dice So Nice, the full world-settings menu. Token/bars, a basic set of status-effects (including the fear one from Phase 6A) and chat-cards are in 0.1 in a minimal form. Any later schema change = migration (§8).

---

## 11. Immediate next step

**All phases 0-14 are closed ✅.** The system is at **0.3.3** on `main` (per-phase status markers in §5, release history in §10).

**Current focus: bug-hunting and playtesting toward 1.0.0.** Real play sessions surface the kind of defects the 0.3.x releases have been fixing (see the 0.3.x entries in `CHANGELOG.md`) — rule-fidelity drift, stale-state UI bugs, async race conditions. The working loop now is: playtest → issue → hotfix branch → PR → patch release.

The Phase 0.B nice-to-haves that never proved necessary (`/add-item-type`, `/pdf`, `/phase-test`, `/foundry-link`, the `foundry-test-runner` subagent, `docs/claude-workflow.md`) remain open — added only **when a real need arises**, not ahead of it.
