# Implementation plan: Deadlands Classic — Community Edition for Foundry VTT v14+

> English translation of [`implementation-plan.md`](implementation-plan.md) (Polish original). Kept for English-speaking contributors; the Polish file is the one actively maintained — if they diverge, the Polish file wins.

> Architecture document and implementation roadmap for the system. Reference point for all contributors.

## Context

We are building a **game system** for Foundry VTT from scratch, supporting **Deadlands Classic 20th Anniversary Edition** (Weird West, 1876). The repository currently holds only metadata files (README, LICENSE, system.json, issue templates) — no code. We have two reference projects in the repo under `vendor/` (`vendor/DeadlandsClassic/` — Dulux-Oz, newer; `vendor/Deadlands-Classic/` — RhombusWeasel, older v9) plus the original rulebook PDF (413 pages). We do not copy code from the references (different licenses, different assumptions), but we learn from their patterns.

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
├── _base/                       # Shared base
│   ├── base-character-data.mjs  # Traits, aptitudes, wounds, wind, chips, edges/hindrances
│   ├── base-character-sheet.mjs # Shared sheet (tabs: Traits/Combat/Gear/Bio)
│   └── mixins/                  # Composable mechanics modules
│       ├── poker-caster.mjs     # For Huckster
│       ├── ritual-caster.mjs    # For Shaman
│       ├── miracle-invoker.mjs  # For Blessed
│       ├── gizmo-builder.mjs    # For Mad Scientist
│       └── harrowed-overlay.mjs # Harrowed — applicable to any PC
├── cowboy/
│   ├── manifest.mjs             # ArchetypeRegistry.register({...})
│   ├── data.mjs                 # CowboyDataModel extends BaseCharacterDataModel
│   ├── sheet.mjs                # CowboySheet extends BaseCharacterSheet
│   ├── templates/cowboy.hbs     # (or reuse base)
│   └── lang/{en,pl}.json        # Archetype-specific keys
├── huckster/
│   ├── manifest.mjs             # Registers + wires in the poker-caster mixin
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

### 3.6 Archetype-specific item types (in the archetype folders)
- `hex` (Huckster) — `hand` (min poker hand), `trait`, `speed`, `duration`, `range`, `effect`
- `miracle` (Blessed) — `tn`, `speed`, `duration`, `range`, `effect`, `sinSeverity`
- `favor` (Shaman) — `appeasement`, `ritualType[]`, `duration`, `range`, `effect`
- `gizmo` (Mad Scientist) — `theoryText`, `blueprintHand`, `constructionTN`, `reliability`, `malfunctionEffect`

Each item type is registered through `ItemRegistry`, analogously to archetypes.

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
│   │   ├── dice/
│   │   │   ├── exploding-roll.mjs
│   │   │   ├── trait-roll.mjs
│   │   │   ├── damage-roll.mjs
│   │   │   └── poker-hand-evaluator.mjs
│   │   ├── cards/
│   │   │   ├── action-deck.mjs
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
│   │   └── items/                       # Shared item types
│   │       ├── weapon-data.mjs
│   │       ├── armor-data.mjs
│   │       ├── gear-data.mjs
│   │       ├── edge-data.mjs
│   │       ├── hindrance-data.mjs
│   │       └── ammo-data.mjs
│   ├── archetypes/
│   │   ├── _base/
│   │   │   ├── base-character-data.mjs
│   │   │   ├── base-character-sheet.mjs
│   │   │   └── mixins/…
│   │   ├── cowboy/
│   │   ├── huckster/
│   │   ├── shaman/
│   │   ├── blessed/
│   │   ├── mad-scientist/
│   │   ├── _overlays/harrowed/
│   │   ├── npc/                         # GM-controlled full NPC
│   │   └── mook/                        # Simplified grunt
│   └── ui/
│       ├── fate-chip-widget.mjs
│       ├── action-deck-tracker.mjs
│       └── wound-locations-widget.mjs
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
│   ├── aptitudes/                       # Pre-populated aptitude list
│   ├── hit-location/                    # RollTable
│   └── archetype-examples/              # Example NPCs, one per archetype
├── icons/                               # SVG (cards, chips, wound severity, archetype icons)
├── docs/
│   ├── notes.md                         # (exists)
│   ├── implementation-plan.md           # THIS file
│   ├── architecture.md                  # registry pattern + contract (exists; diagram + SemVer in Phase 14)
│   ├── v14-api-notes.md                 # V14 patterns (exists)
│   ├── mechanics-reference.md           # mechanics paraphrase + page citations (exists)
│   └── extending-archetypes.md          # How to add a new archetype (to be created)
├── tools/
│   └── verify-documenttypes.mjs         # Sanity-check script: documentTypes == registered archetypes
├── .github/
└── CHANGELOG.md, README.md, CONTRIBUTING.md, LICENSE, SECURITY.md, CODE_OF_CONDUCT.md
```

---

## 5. Phased plan — incremental, one file at a time

Each phase ends with a **working, testable** system. After each file in a phase: reload Foundry, verify in the UI, commit. The phases are in dependency order.

### Phase 0 — Repo configuration, metadata, and AI workshop (16-25 files + memory update)

**Status:** ✅ **CLOSED** (Part A + Part B essentials completed before Phase 1; Part B nice-to-haves continued in the background of Phases 1-3).

**Goal:** Every subsequent phase (1+) must have full Claude Code support — hooks that validate syntax immediately after an edit, slash commands for repeatable operations (new archetype, new item type, verify system), subagents for domain tasks (V14 API check, PDF lookup, mechanic verification), pre-commit as an independent safety net. **Without the workshop, every phase drags on and accumulates regressions.** That's why Phase 0 combines metadata stabilization with a complete AI-environment setup.

#### Part A — Repo metadata (6 files) ✅

1. **Update `system.json`** — `compatibility.minimum/verified: "14"`; add `"type": "system"`; finalize `documentTypes.Actor: {cowboy, huckster, shaman, blessed, madScientist, npc, mook}` (each with `htmlFields: ["system.biography"]` except `mook`); `documentTypes.Item: {weapon, armor, gear, edge, hindrance, ammo}` as core (archetype types `hex/miracle/favor/gizmo` added by their manifests in Phases 9-10, not in Phase 0); add `initiative`, `primaryTokenAttribute` (`system.wind.value`), `esmodules: ["module/deadlands-classic.mjs"]`, `styles: ["styles/deadlands-classic.css"]`, `languages: [{lang: "en", name: "English", path: "lang/en.json"}, {lang: "pl", name: "Polski", path: "lang/pl.json"}]`, `packs: [...]` (empty in Phase 0, filled per phase).
2. **Correct `README.md`** — compatibility table: `V14 Supported / V13 Not supported / V12 Not supported` (plan: V14-only); scope note: *"v1: Deadlands Classic only; Hell on Earth and Lost Colony deferred to v2+"*; feature list: add the **Legend chip (4th color, reroll a bust)**, **Mad Scientist** as an archetype, **Harrowed overlay**; fix the wound-locations description to 8 locations (PDF p.133); Foundry VTT badge → V14.
3. **`.gitignore`** — add `.claude/settings.local.json`, `.claude/cache/`, `.claude/logs/`. Keep the existing entries: `books/`, `.pdf-extract/`, `/DeadlandsClassic`, `/Deadlands-Classic`, `node_modules/`, `*.log`, IDE, OS, build output.
4. **Empty `lang/en.json` and `lang/pl.json`** — a starting key structure (`DEADLANDS.System.Title`, etc.).
5. **Empty `module/deadlands-classic.mjs`** — an init-hook skeleton, a welcome console.log.
6. **Empty `styles/deadlands-classic.css`** with `@import "./_variables.css"` imports.

#### Part B — Working with Claude Code (10-15 files + memory update)

**Priority split** — so as not to delay Phase 1:
- **Essential** ✅ **(done, required before Phase 1):** #6 CLAUDE.md, #7 settings.json (with a SessionStart hook + a `Write|Edit|MultiEdit` matcher), #8 settings.local.json (narrowed to 6 user-specific entries), #9 hooks, #12 pre-commit, #13 verify-documenttypes.mjs, #14 biome+package.json, #15 memory update, #17 tests/ stub (smoke test), #19 `.claude/rules/` (5 files with `paths:` auto-scope frontmatter), #20 `.mcp.json` (Playwright + context7).
- **Nice-to-have** ⏳ (filled in the background during Phases 1-3, as real needs become visible): #10 the remaining slash commands (besides `/verify-system` — `/add-archetype`, `/add-item-type`, `/pdf`, `/phase-test`, `/foundry-link`, `/new-phase`), #11 the remaining subagents (besides `pdf-reference-lookup` — `foundry-v14-checker`, `archetype-scaffolder`, `foundry-test-runner`, `mechanic-verifier`), #16 docs/claude-workflow.md, #18 ci.yml.

6. **`CLAUDE.md`** (root) — the main project context loaded into every Claude session. **Workflow:** run the `/init` skill as a starting point (a quick draft that knows the repo conventions), then manually fill in the Deadlands specifics per the list below:
   - Stack and conventions: **V14 only**, ES modules (.mjs) without a bundler, no TypeScript; JSDoc for the public core API
   - Key architectural patterns: the **registry pattern** (link to plan section 2), TypeDataModel per type, ApplicationV2 + HandlebarsApplicationMixin
   - Directory structure (link to section 4), the principle: a core agnostic to archetypes (section 3)
   - Dev rules: conventional commits, `node --test` tests for pure core logic, EN+PL localization from the start (zero hardcoded strings in the UI)
   - Links to the sources of truth: `docs/implementation-plan.md` (this document), `docs/notes.md`, `docs/architecture.md` (planned), memory files
   - Reference rule: `DeadlandsClassic/` and `Deadlands-Classic/` in the repo — READ for patterns, do NOT copy (different license, older API). The rulebook PDF — page/mechanic lookup only, zero copy-paste of content into packs
   - Editable-surface rule: don't edit files outside `module/`, `templates/`, `styles/`, `lang/`, `packs/`, `docs/`, `tools/`, `tests/`, `.claude/`, `.github/`, `.githooks/` without explicit user consent

7. **`.claude/settings.json`** (committed, shared by all contributors) — permissions, hooks, env:
   - `permissions.allow`: `Bash(node:*)`, `Bash(node --check:*)`, `Bash(node --test:*)`, `Bash(npm run test:*)`, `Bash(npm run fmt:*)`, `Bash(npm run lint:*)`, `Bash(git status:*)`, `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(ln -s:*)`, `WebFetch(domain:foundryvtt.com)`, `WebFetch(domain:foundryvtt.wiki)`, `Bash(pdftotext:*)`
   - The PDF scripts (`extract-pdf.sh`, `verify-pdf-extract.sh`) have been moved to `deadlands-rules-ref/scripts/` — invoked via `$DEADLANDS_RULES_PATH/scripts/`. `settings.local.json` is the proper place for any allow rules for those paths (user-specific).
   - **Migration from `settings.local.json`** — the current `.claude/settings.local.json` holds project-scoped permissions (pdftotext, awk, WebFetch to foundryvtt). Move them into `settings.json` (all contributors need them); in `settings.local.json` keep only the user-specific ones (FOUNDRY_DATA path, ad-hoc experiments).
   - `permissions.deny`: `Bash(rm -rf:*)`, `Bash(git push --force:*)`, `Bash(git reset --hard:*)`, `Bash(git clean -f:*)`
   - `env.DEADLANDS_DEV=1` (for future gating of dev-only UI)
   - **Optimization after 3-5 sessions:** run the `/fewer-permission-prompts` skill, which scans the transcript and adds the actually-used commands to the allowlist (instead of speculating now).

8. **`.claude/settings.local.json`** — local overrides (`FOUNDRY_DATA` path, user-specific permissions). Git-ignored (already in #2).

9. **Hooks** (in `.claude/settings.json`) — immediate validation, blocks regressions in the same turn:
   - **SessionStart** → `git config core.hooksPath .githooks` (idempotent, eliminates the manual step after a clone — `.githooks/commit-msg` and `.githooks/pre-commit` work from the first session)
   - **PostToolUse** on `Write|Edit|MultiEdit` for `*.mjs` → `node --check "$file_path"` — a syntax check; an error blocks further work and points to the line
   - **PostToolUse** on `Write|Edit|MultiEdit` for `*.json` → a parse check (JSON.parse test)
   - **PostToolUse** on `Write|Edit|MultiEdit` for `system.json` → additionally `node tools/verify-documenttypes.mjs`
   - **PostToolUse** on `Write|Edit|MultiEdit` for `lang/*.json` → a check: the EN and PL keys pair up (a key diff = an error)
   - **PreToolUse** on `Bash(git push --force:*)` → deny (independent of permissions, extra safety)
   - **UserPromptSubmit** (optional) → inject the current branch + the version from `system.json` into the context

10. **Custom slash commands** (`.claude/commands/*.md`):
    - **`/add-archetype <id>`** — scaffolds `module/archetypes/<id>/{manifest,data,sheet}.mjs`, adds `documentTypes.Actor.<id>` to `system.json`, adds the `DEADLANDS.Archetype.<Id>.*` keys to `lang/en.json` + `lang/pl.json`. Delegates to the `archetype-scaffolder` subagent.
    - **`/add-item-type <id>`** — analogously, for a new item type.
    - **`/verify-system`** — `node tools/verify-documenttypes.mjs` + JSON lint + `node --check` recursively over `module/`. A short text report.
    - **`/pdf <query>`** — invokes the `pdf-reference-lookup` subagent (see #11), returns a page number + a short quote.
    - **`/phase-test <n>`** — pulls the **Test:** block for Phase n out of `docs/implementation-plan.md` and presents it as a checklist.
    - **`/foundry-link`** — prints `ln -s $(pwd) "$FOUNDRY_DATA/Data/systems/deadlands-classic"` + a reload hint.
    - **`/new-phase <n>`** — creates the branch `phase-<n>/<slug>`, loads the Phase n section from the plan as context, generates a file checklist.

11. **Subagents** (`.claude/agents/*.md`) — each with a triggering description; Claude picks one automatically when the context matches:
    - **`foundry-v14-checker`** — audits changes for V14 API. Blocks V13 patterns: `extends Application` (instead of `ApplicationV2`), `template.json`, `game.system.template`, `game.system.model`, TinyMCE refs, `Actor.create({type: "character"})` when there's no documentType in system.json. Tools: Read, Grep, WebFetch (foundryvtt wiki).
    - **`pdf-reference-lookup`** — reads `memory/reference_pdf_lookup.md`, the catalog + per-book index, returns pages + a short fragment for mechanical queries. Tools: Read, Grep.
    - **`archetype-scaffolder`** — writes a complete archetype (data model + sheet class + manifest + partials + i18n keys) following the `_base/` convention. Used by `/add-archetype`. Tools: Read, Write, Edit, Glob.
    - **`foundry-test-runner`** — runs `node --test tests/` and summarizes failures with file:line pointers. Tools: Bash, Read.
    - **`mechanic-verifier`** — for a mechanic being implemented (exploding dice, chip spend, poker eval) verifies the code's fidelity to the PDF: delegates the PDF lookup, compares with the implementation, reports discrepancies. Tools: Read, Grep.

12. **`.githooks/pre-commit`** (git-level safety, independent of Claude — for contributors without Claude Code and as a last line of defense):
    - `node --check` on staged `.mjs`
    - JSON lint on staged `.json`
    - `node tools/verify-documenttypes.mjs` if `system.json` is staged
    - Instruction in the README: `git config core.hooksPath .githooks` once at clone time.

13. **`tools/verify-documenttypes.mjs`** (MVP, extended in Phase 14) — parses `system.json`, imports `module/deadlands-classic.mjs`, compares `documentTypes.Actor/Item` with `ArchetypeRegistry.all()` + `ItemRegistry.all()`. Exit 1 on a mismatch with a text diff. Used by: hook #9, `/verify-system`, pre-commit #12, CI.

14. **`.editorconfig` + `biome.json` + `package.json`** — **Biome** as the sole tool (JS+JSON+CSS, zero-config, ~100× faster than eslint+prettier). Scripts: `npm run fmt`, `npm run lint`, `npm run test` (`node --test tests/`). `package.json` — only dev deps + `"engines": { "node": ">=24" }` (V14 requires Node 24 — memory `v14_api_notes.md`) + `"type": "module"` so that `.mjs` files in `tests/` are treated consistently.

15. **Update the memory files** (in `~/.claude/projects/-home-binn-projects-foundryvtt-deadlands-classic-fvtt/memory/`):
    - **New** `architecture.md` — the registry pattern as the project's foundation (a summary of plan section 2 + the `ArchetypeDefinition` contract)
    - **Update** `game_mechanics.md` — the Legend chip (4th color, worth 5 BP, reroll a bust), 5 wound severity levels (Light→Maimed), Harrowed as an overlay rather than an actor type
    - **Update** `v14_api_notes.md` — snippets for `TypeDataModel`, `ApplicationV2 + HandlebarsApplicationMixin`, `documentTypes`, the `Cards` API for the action deck
    - **New** `dev_workflow.md` — the list of slash commands, a "problem → subagent" map, hook behavior, when to use the built-in skills (`simplify` after a feature, `review` on a PR, `security-review` before a release, `frontend-design` for HBS+CSS sheets)

16. **`docs/claude-workflow.md`** (new) — onboarding for a contributor using Claude Code:
    - Installing Claude Code, hooking it up to the repo
    - A symlink to `$FOUNDRY_DATA/Data/systems/`
    - The list of slash commands with examples
    - The subagent map: problem → agent
    - Commit conventions — a link to `.claude/rules/commits.md`
    - The PR flow with `.github/PULL_REQUEST_TEMPLATE.md`

17. **`tests/` stub** — `tests/.gitkeep` + `tests/smoke.test.mjs` (`node:test`, one test `assert.ok(true)`) so that `npm run test` passes from Phase 0. Real tests are added in later phases: `exploding-roll.test.mjs` in Phase 3, `chip-rules.test.mjs` in Phase 5, `wound-track.test.mjs` in Phase 6, `poker-evaluator.test.mjs` in Phase 9.

18. **`.github/workflows/ci.yml`** (optional but recommended already in Phase 0) — triggers on `push`/`pull_request`. Steps: `actions/setup-node@v4` (node-version `24`), `npm ci`, `npm run lint`, `npm run test`, `node tools/verify-documenttypes.mjs`. Duplicates pre-commit (#12), but pre-commit requires opt-in via `core.hooksPath` — CI is the guarantee for PRs from external contributors. `release.yml` (ZIP packaging) only in Phase 14.

19. **`.claude/rules/` (a native Claude Code feature)** — 5 `.md` files with `paths:` frontmatter to be auto-loaded into context when Claude reads matching files:
    - `commits.md` (always, no `paths:`) — conventional commits + the ban on `Co-Authored-By: Claude` (enforced by `.githooks/commit-msg`)
    - `naming.md` (always, no `paths:`) — the convention table (camelCase / kebab-case / PascalCase / SCREAMING_SNAKE_CASE per context)
    - `v14-api.md` (`paths: module/**/*.mjs`) — V13 anti-patterns + preferred V14 patterns
    - `localization.md` (`paths: lang/**`, `module/**`, `templates/**`) — EN/PL parity, the `DEADLANDS.*` namespace
    - `references.md` (`paths: vendor/**`) — the ban on copying code from the GPL-3.0 reference tree (`vendor/`)
    Rules are passive (statements/prohibitions loaded into context), complementary to skills (active procedures) and subagents (specialized reviewers).

20. **`.mcp.json`** (project-scoped, committed) — MCP servers that extend Claude's capabilities:
    - **Playwright MCP** (`@playwright/mcp`) — driving a browser for E2E tests of Foundry sheets (open a world, create an actor, click a trait, verify a chat message). Closes the gap *"Foundry-dependent code is verified manually"*. Headed by default, downloads its own Chromium on first use (~200MB).
    - **context7 MCP** (`@upstash/context7-mcp`) — a fast lookup of current library documentation (Foundry V14 API, Biome, Node.js, ProseMirror) without parsing HTML via WebFetch.
    The servers require approval on first launch (*"Allow project-scoped MCP server 'X'?"*). Playwright artifacts (`test-results/`, `playwright-report/`, `.playwright/`) added to `.gitignore`.

**Phase 0 test** (all must pass before Phase 1):
- **Sanity pre-check:** `$DEADLANDS_RULES_PATH/index/dlc.md` and `$DEADLANDS_RULES_PATH/extracts/dlc/full.txt` exist (the PDF-index was migrated to the private repo `deadlands-rules-ref` — see CLAUDE.md »PDF rulebook«; lookup via the `pdf-reference-lookup` subagent).
- The symlink to `Data/systems/deadlands-classic` works; Foundry opens a world without errors; the init hook logs a welcome. **Note:** creating an actor won't work until Phase 2 (no `dataModels` in `CONFIG.Actor`) — Phase 0 only tests booting the system and registering `documentTypes`.
- `/verify-system` → OK (empty registries match the documentTypes from `system.json`, the EN/PL keys pair up)
- `npm run test` → green (the placeholder `tests/smoke.test.mjs` passes)
- `npm run lint` → no errors (Biome)
- Editing a test `.mjs` with a deliberate syntax error → the `node --check` hook reports the error in the same turn
- Editing `system.json` with a non-existent documentType → the hook runs `verify-documenttypes.mjs` and reports a diff
- Editing `lang/en.json` (adding a key without a PL pair) → the hook reports the key-set difference
- `pdf-reference-lookup` "fate chips rules" → `dlc` p.146-148; "hit location table" → `dlc` p.133 (the `/pdf` slash command still pending — nice-to-have)
- `/add-archetype test-dummy` creates the folder, adds to `system.json` and `lang/*`; after a Foundry reload the new actor type is available in the UI → then we remove it (a test of the full scaffolding cycle + rollback)
- Pre-commit rejects a commit with broken JSON in `system.json`
- CI (if #18 is enabled) — green builds on a PR with correct code; a deliberately broken `.mjs` in a test PR gets blocked
- Memory files updated — a new Claude session loads `architecture.md` and knows the registry pattern without asking; `game_mechanics.md` has 4 chip colors, 8 hit locations, the Harrowed overlay
- README (V14-only, Classic-only in v1, new features) consistent with the plan — a visual inspection
- `.claude/rules/` works: editing `lang/en.json` in a new session loads `localization.md` into context (visible from Claude applying EN/PL parity without being asked)
- MCP servers available: after a session restart and approval, `mcp__playwright__*` and `mcp__context7__*` are visible in the tool list

### Phase 1 — Core foundations: config + registries (5-7 files)
1. `module/core/config.mjs` — DEADLANDS constants: `TRAITS`, `APTITUDES` (grouped by trait), `CHIP_COLORS`, `WOUND_SEVERITIES`, `HIT_LOCATIONS`, `TNS`, `CARD_RANKS`, `CARD_SUITS`.
2. `module/core/archetype-registry.mjs` — the Registry class.
3. `module/core/item-registry.mjs` — analogously for items.
4. `module/core/overlay-registry.mjs` — for Harrowed and future overlays.
5. `module/core/documents/deadlands-actor.mjs` — `class DeadlandsActor extends Actor` with base util methods (`rollTrait`, `spendFateChip`).
6. `module/core/documents/deadlands-item.mjs` — analogously.
7. Entry file: imports + an init hook using the registries (empty for now).

**Test:** the console `game.deadlandsClassic.archetypes.all()` returns `[]`. The system loads without errors.

### Phase 2 — Base character data + sheet (6-8 files)
1. `module/archetypes/_base/base-character-data.mjs` — a TypeDataModel with all the common fields: 10 traits (each: `dieCount, dieType, modifier, aptitudes{}`), wounds per location (severity), wind (`value/max`), chips, grit, pace, size, bounty, biography, edges/hindrances list (items). **From the start:** `static migrateData(source)` (a stub) + `migrationVersion` in world settings — so that later schema changes (0.1→0.2) don't break existing worlds (see §8, migration risk).
2. `module/archetypes/cowboy/data.mjs` — inherits from base, no extra schema.
3. `module/archetypes/cowboy/manifest.mjs` — register.
4. `module/archetypes/_base/base-character-sheet.mjs` — ApplicationV2 + HandlebarsApplicationMixin. Tabs: Traits, Combat, Gear, Bio. The associated contextPrepare.
5. `module/archetypes/cowboy/sheet.mjs` — extends base, no-op.
6. `templates/actor/parts/traits-tab.hbs` — the layout of traits and aptitudes (faithful to the sheet `dlc` p.412-413).
7. `templates/actor/parts/combat-tab.hbs` — wounds widget, wind bar, chip count, weapon list.
8. `templates/actor/parts/gear-tab.hbs` + `bio-tab.hbs`.

**Test:** create an actor of type `cowboy`, the sheet opens, displays all 10 traits and 30+ aptitudes. Editing die/dieCount saves.

### Phase 3 — Core dice engine (3 files)
1. `module/core/dice/exploding-roll.mjs` — the function `rollExplodingPool({dieCount, dieType, modifier, tn})`, postprocessing for bust/raises.
2. `module/core/dice/trait-roll.mjs` — sends to chat with a result card (success/raises/bust).
3. `module/core/dice/damage-roll.mjs` — integration with armor reduction.

**Test:** from the console: `game.deadlandsClassic.dice.rollTrait({dieCount: 4, dieType: "d8", tn: 5})` returns a result, a chat message appears. A max (8) explodes.

### Phase 4 — Actor sheet ↔ dice integration (2-3 files)
1. Modify `base-character-sheet.mjs` — a trait/aptitude click listener → an aptitude-selection dialog → `trait-roll`.
2. `templates/dialogs/trait-roll-dialog.hbs` — dialog: choosing chips (white/red/blue/legend), modifiers, TN.
3. `styles/chips.css` — the chip-spend widget.

**Test:** in the sheet click "Shootin'", fill in the dialog, send the roll. Chat shows the result. A white chip is subtracted from the actor (from `system.chips` — the field exists since Phase 2, so the spend works without the pool), dieCount is incremented for the roll.

> **Dependency (resolved after the audit):** Phase 4 spends from the **player's own chips** (`system.chips`, available since Phase 2) — it does NOT require the pool. The central Fate Pot + the `canSpend` validation (limit 1/action red/blue, bust-block) come in Phase 5. That's why the Phase 4 test is achievable within the phase (the dialog for non-white chips can be disabled/stubbed at this stage).

### Phase 5 — Fate Pot & chip system (3-4 files)
1. `module/core/chips/fate-pot.mjs` — the `FatePot` class over a **world setting** (`game.settings`, 4 integers `{white,red,blue,legend}`); registering the setting in `init`, the starting seed in `ready` (decision D2 — NOT Cards, NOT Actor).
2. `module/core/chips/chip-widget.mjs` — a UI component in the sheet.
3. `module/core/chips/chip-rules.mjs` — `canSpend(color, context)` (limit 1/action red/blue, bust-block, etc.).
4. A "Draw Fate Chips" dialog (start of session): `game.deadlandsClassic.chips.drawForSession()` — 3 per player.
5. **No pack** — the pool is a world setting; seed 50W/25R/10B/0L in `ready` (`FatePot.reset()`), not a compendium (D2).

**Test:** the "Draw Fate" command in the GM menu hands out 3 random chips to each PC. The counter in the sheets updates. You can spend a chip on a roll (white → +1 die to the pool).

### Phase 6 — Wounds, wind, hit locations (5-6 files)
1. `module/core/wounds/wound-track.mjs` — the `WoundTrack` helper: `addWound(actor, location, severity)`, `healWound(...)`, the cumulative modifier computed in `prepareDerivedData` (code, not 8 independent AEs — §8). **Consumer:** extend `trait-roll` (Phase 3/4) with a `woundModifier` input so that wounds actually lower rolls — without that step nothing reads the wound ActiveEffects.
2. `module/core/wounds/hit-location.mjs` — a rolltable helper + UI.
3. `module/core/wounds/wind-calculator.mjs` — computes `wind.max` from Vigor+Spirit die values.
4. Pack `packs/hit-location/` — a RollTable `1d20 → location`.
5. Integration in `damage-roll.mjs` — after damage: roll location (or a "called shot" dialog), apply severity.
6. `templates/actor/parts/wound-locations-widget.hbs` — a graphical rendering of the body (8 locations per PDF p.133: Noggin, Upper Guts, Lower Guts, Gizzards, Left/Right Arm, Left/Right Leg) with colored severity slots.

**Test:** roll damage from a weapon, the system draws a location, applies a wound of the appropriate severity. Wind max reloads after a Vigor/Spirit change.

### Phase 6A — Guts / fear checks (2-3 files) — THE CORE OF HORROR
The fear mechanic was a gap in the original plan (added after the 2026-06-17 audit). Without it the system runs a generic Western, not Deadlands. **First verify the mechanic in `dlc` via `pdf-reference-lookup`** (the fear / Fear Level / Guts chapter) — don't code from memory.
1. `module/core/dice/guts-check.mjs` — `gutsCheck(actor, {fearLevel, terror})`: a Guts roll (Spirit aptitude) vs TN from the fear level; postprocessing for the failure level.
2. Integration: the effects of a failed Guts (e.g., loss of Wind, in the extreme a fear state as an ActiveEffect/condition on the token HUD).
3. `templates/dialogs/guts-check.hbs` + a result chat-card.

**Test:** `gutsCheck(actor, {fearLevel: 3})` → a Guts roll, chat shows success/failure and the effect; a failed check subtracts Wind / applies a state.

### Phase 7 — NPC + Mook archetypes (3-4 files)
Simpler than PCs. Mook = 1 wound track instead of 8; NPC = full but without chips.

**Test:** create an `npc` and a `mook` actor; the NPC sheet opens with full traits but no chip widget; the mook has a single wound track. A trait roll works for both.

### Phase 8 — Action Deck & Combat (5-7 files)
1. `module/core/cards/action-deck.mjs` — a wrapper around the Cards API.
2. `module/core/cards/deadlands-combat.mjs` — `class DeadlandsCombat extends Combat` with `rollInitiative` dealing cards.
3. `module/core/cards/deadlands-combatant.mjs` — tracks the hand, the sleeved card.
4. Pack `packs/action-deck/` — 54 cards (52 + 2 jokers) as a preset.
5. `templates/dialogs/combatant-hand.hbs` — show the card/cards, a "Play card" button.
6. A custom combat tracker widget: shows the order by cards, suit tiebreaker (♠>♥>♦>♣), joker highlighting.

**Test:** start combat with 2 PCs + 2 mooks, the system deals cards (a Quickness roll vs TN 5 → 1 card + 1 per success and raise, max 5). Round-by-round: play the highest card. Red Joker → Fate Chip reward. Black Joker → penalty.

### Phase 9 — Huckster archetype + hexes (6-8 files)
1. `module/archetypes/huckster/data.mjs` — extends base + `hexesLearned`, `lastDraw`, `backlashPending`.
2. `module/archetypes/huckster/sheet.mjs` — adds a "Hexes" tab.
3. `module/archetypes/huckster/mechanics.mjs` — `castHex(hex)`: roll hexslingin' → success → draw N cards → evaluate poker hand → apply effect.
4. `module/core/dice/poker-hand-evaluator.mjs` — an evaluator: Royal/Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, Pair, High Card.
5. The `hex` item type registered in `ItemRegistry` via `huckster/manifest.mjs`.
6. `templates/actor/parts/hexes-tab.hbs` + a casting dialog.
7. Pack `packs/edges-srd/` — the Arcane Background (Huckster) edge with its mechanical effects.
8. Pack `packs/hexes-srd/` — example hexes (Soul Blast, Private Eye, Shadow Walk, etc.) with TN/hand/speed/duration/range fields.

**Test:** a PC with a Huckster sheet has a "Hexes" tab. Click "Cast Soul Blast" → a hexslingin' roll → a poker simulation → chat shows the result with the applied effect. Backlash if a Black Joker.

### Phase 10 — Blessed + Shaman + Mad Scientist (3 × 4-5 files)
Analogous to Huckster, each in a separate folder. Archetype-specific mechanics:
- **Blessed** — `miracles.mjs`: a Faith roll vs. the miracle TN; a sin tracker (loss of Faith).
- **Shaman** — `favors.mjs`: a ritual roll → appeasement points → spend on a favor.
- **Mad Scientist** — `gizmos.mjs`: theory → blueprint (poker hand) → construction (Tinkerin' roll) → reliability (d20 check on use).

**Test:** each of the 3 archetypes has its own tab; after one example act of power (miracle/favor/gizmo) it runs the full flow to a chat-card. Blessed: the sin tracker grows after a failure. Shaman: appeasement accumulates and can be spent. Mad Scientist: a gizmo gets a reliability and a d20 roll on use.

### Phase 11 — Harrowed overlay (3-4 files)
1. `module/archetypes/_overlays/harrowed/manifest.mjs` — `OverlayRegistry.register`.
2. `data-schema.mjs` — extra fields: `isHarrowed: bool`, `dominion: {spiritControl, lastRoll}`, `harrowedPowers: []`, `countingCoup: {tally, deeds}`.
3. `sheet-tab.mjs` — injects a "Harrowed" tab into the base sheet when `isHarrowed=true`.
4. `mechanics.mjs` — `dominionRoll(actor)` (opposed Spirit + Dominion, per session) at the start of a session.

**Test:** a PC with Harrowed activated has an extra tab with a dominion check. The dominion roll triggers **at the start of a session** (per game session, during sleep — NOT at the start of combat; `dlc` p.195/253).

### Phase 12 — Edges, Hindrances, Aptitudes content packs (2-3 files + data)
1. Pack `packs/edges-srd/` — ~30 edges with names, costs, a short mechanical description (no copy-paste flavor from the PDF).
2. `packs/hindrances-srd/` — ~40 hindrances.
3. `packs/aptitudes/` — a list of aptitudes as JournalEntries or a RollTable to ease selection (optional).
4. ActiveEffect integration: edges like "Level-Headed" (draw an extra card) add flags that modify mechanics via hooks.

**Note on copyright:** the pack content contains only mechanics (name, cost, a short technical 1-2 sentence description of the effect). Flavor text and long descriptions — users enter those themselves. The same as the SWADE community practices.

**Test:** the pack builds via `fvtt package pack` from `packs/_source/`; after import, adding the "Level-Headed" edge to a PC adds a flag modifying initiative (a hook), and "Nerves o' Steel" adds an AE +1 to Guts.

### Phase 13 — Localization completion (full EN/PL) (1-2 files)
A pass through all `localize()` calls and making sure the keys are in both files. **PL: we adopt the canon of the official MAG translation ("Martwe Ziemie", 2001) — we do NOT invent terms.** Sources in `deadlands-rules-ref`: `pg-pl` (core + archetypes), `char-sheet-pl` (sheet field labels → direct equivalents for `lang/pl.json`), the per-archetype companions (`hnh-pl`, `ghost-dancers-pl`, `law-dogs-pl`, `fb-pl`). Canonical terms: "Cecha" (Trait), "Umiejętność" (Aptitude), **"Szton Losu"** (Fate Chip; Legend = "Szton-Legenda"; colors "biały/czerwony/niebieski"), archetypes "Kowboj / **Kanciarz** (Huckster) / Szaman / **Świątobliwy** (Blessed) / Szalony Naukowiec / **Wygrzebany** (Harrowed)". Magic: "Kantowanie" (Hexslingin'), "Rytuały" (Rituals), "Przysługi" (Favors).

**Test:** switching the language to `pl` swaps all visible strings (zero `DEADLANDS.*` keys in the DOM); the terms match the MAG canon; `verify-documenttypes` confirms EN/PL key parity.

### Phase 14 — Polish, release, CI (4-6 files)
1. ~~`.github/workflows/release.yml`~~ **ALREADY EXISTS** (built in the background of Phase 0.B; tag→ZIP→Release with a version guard). Here just end-to-end verification on a real tag. Add `.github/workflows/ci.yml` (lint + `node --test` + `verify-documenttypes`) — **without** Foundry E2E (see §8: CI can't run a licensed Foundry).
2. `tools/verify-documenttypes.mjs` — extend: whether `system.json documentTypes` matches `ArchetypeRegistry.all()` + `ItemRegistry.all()`.
3. `docs/architecture.md` — **extend the existing one** with a diagram + a description of the registry pattern; **document the registry/hooks/`game.deadlandsClassic` as a stable API with a SemVer policy** (extension modules depend on it — §8).
4. `docs/extending-archetypes.md` — a step-by-step tutorial for adding a new archetype.
5. `docs/migration-policy.md` + `tests/migration.test.mjs` — the world-data migration policy (§8; `migrationVersion` seeded since Phase 2).
6. `CHANGELOG.md` → 0.1.0; `README.md` — screenshots, feature status, compatibility table (pin `verified` to a real build, e.g. `14.364`); **an a11y pass** (sepia/red contrast, keyboard accessibility, `aria-label` on the icons and the body widget).

**Test:** a test tag → CI builds a ZIP with `system.json`, a Release is created with assets; a fresh install from the manifest URL loads in a clean Foundry V14.

---

## 6. Important files to modify/create (list)

**Exists in the repo after Phase 0.A (done ✅):**
- `system.json` ✅ — V14 + `type: "system"` + `documentTypes` (7 actors, 6 items) + esmodules/styles/languages/empty packs
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

**Pending in Phase 0.B nice-to-have (background of Phases 1-3 — ⏳ still open):**
- The remaining slash commands: `/add-archetype`, `/add-item-type`, `/pdf`, `/phase-test`, `/foundry-link`, `/new-phase`
- The remaining subagents: `foundry-v14-checker`, `archetype-scaffolder`, `foundry-test-runner`
- `docs/claude-workflow.md`
- `.github/workflows/ci.yml`

**Doesn't exist (will be created in later phases):**
- System code (Phases 1-13): all files under `module/core/`, `module/archetypes/`, `module/ui/`, `templates/`, the remaining `styles/*.css`, the compendium `packs/` (+ `packs/_source/` and the `fvtt package pack` build), the remaining tests
- Docs (Phase 14): `docs/extending-archetypes.md`, `docs/migration-policy.md` (`docs/architecture.md`, `v14-api-notes.md`, `mechanics-reference.md` already exist)
- CI test: `.github/workflows/ci.yml` — still pending (nice-to-have)

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
| **CI can't run Foundry** — a commercial license: the binaries may not be committed, the key = the owner's secret; external PRs won't run E2E. | H×M | CI only license-free (lint, `node --test`, `verify-documenttypes`); Playwright E2E = **locally**, not a PR gate. Documented in `docs/claude-workflow.md`. Source: foundryvtt.com/article/license. |
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
| **1.0.0** | Stable, a 3-month bug-hunt, full PL localization (MAG canon) | +X |
| **1.x** | Classic supplements (Smith & Robards, Book o' the Dead, etc.) as separate modules |
| **2.0** | Hell on Earth Classic as a separate fork or module |

¹ Corrected after the audit (originally 20-25): Phase 8 (overriding `Combat`/the tracker in ApplicationV2) is realistically 4-6 sessions on its own; ≥5 open decisions require spikes. The estimate is a lower bound.

**Consciously out of scope for 0.1 (a declaration, not an oversight — 2026-06-17 audit):** character generation / point-buy (manual field editing in 0.1), spending Bounty Points + advancement/XP (in 0.1 BP is just chip income), encumbrance, mounts/vehicles, Dice So Nice, the full world-settings menu. Token/bars, a basic set of status-effects (including the fear one from Phase 6A) and chat-cards are in 0.1 in a minimal form. Any later schema change = migration (§8).

---

## 11. Immediate next step

**Phase 0 closed ✅** (part A + part B essentials + tests/ stub + rules + MCP). The `phase-1/core-foundations` branch is active.

**Active phase: Phase 1** — Core foundations (config + registries + base Actor/Item). Start with `module/core/config.mjs` (DEADLANDS constants).

The file order for Phase 1:
1. `module/core/config.mjs`
2. `module/core/archetype-registry.mjs`
3. `module/core/item-registry.mjs`
4. `module/core/overlay-registry.mjs`
5. `module/core/documents/deadlands-actor.mjs`
6. `module/core/documents/deadlands-item.mjs`
7. Update `module/deadlands-classic.mjs` — wiring in the registries

Phase 0.B nice-to-haves (the remaining slash commands, subagents, `docs/claude-workflow.md`, `.github/workflows/ci.yml`) are added in the background during Phases 1-3, **when a real need arises** — don't get ahead of it.
