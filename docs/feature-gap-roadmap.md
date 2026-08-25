# Feature gap audit and development roadmap

> Rulebook-to-code audit for Deadlands Classic 0.4.1. This document answers two questions:
> what is still missing for play, and in what order should it be implemented?

## 1. Audit baseline

This audit describes system version **0.4.1** at commit `b82b41a` on 2026-08-24. It compares the
working tree against the private `deadlands-rules-ref` corpus. It does not treat the two upstream
Foundry systems as rules authorities.

The following extracts passed the corpus quality gate before the audit:

| Slug | Scope | Physical pages | Extract status |
|---|---|---:|---|
| `dlc` | Core 20th Anniversary rules | 413 | PASS |
| `hnh` | Hucksters & Hexes | 129 | PASS |
| `ghost-dancers` | Ghost Dancers | 129 | PASS |
| `fb` | Fire & Brimstone | 130 | PASS |
| `snr` | Smith & Robards | 129 | PASS |
| `bod` | Book of the Dead | 129 | PASS |

Page references in this document are pointers into those verified extracts. They do not reproduce
rulebook prose. The rulebooks remain the sole authority for implementation details.

### What “implemented” means

A mechanic is not complete merely because a helper function exists. Each row is assessed across
four layers:

| Layer | Completion test |
|---|---|
| Engine | A deterministic rules function or document model exists and has unit coverage where practical. |
| Workflow | A player or Marshal can start and finish the mechanic from a sheet, tracker, chat card, or GM tool. |
| State | The result is persisted correctly, including permissions, concurrency, duration, and migrations. |
| Content | The required selectable items, tables, or example actors are actually available. |

Status labels used below:

- **Usable** — the supported scope works end to end.
- **Partial** — useful foundations exist, but at least one layer is missing.
- **Manual** — the sheet stores the result, but the table must resolve the rule outside the system.
- **Missing** — no meaningful player-facing implementation exists.
- **Out of scope** — setting prose, adventures, or an explicitly deferred product area.

## 2. Executive result

The project has a strong modern Foundry foundation and several good rules engines, but it is not yet
an end-to-end implementation of the core game. Today it is best described as a **character sheet,
roll engine, initiative prototype, and arcane workflow framework**.

The largest functional gap is combat. The system can roll damage and hit locations through its API,
but a weapon on the actor sheet cannot initiate a complete attack. Wounds, Wind, stun, bleeding,
healing, armor, and non-white Fate Chip effects are therefore mostly manual or disconnected.

The second largest gap is the character lifecycle: there is no guided character creation, point
accounting, Bounty Point expenditure, or advancement history.

The third gap is content and effect execution. The companion module contains 31 verified Edges, 58
verified Hindrances, 3 Hexes, 7 example actors, and one hit-location table. It contains no Miracles,
Favors, Gizmos, weapons, armor, gear, ammunition, bestiary, or Harrowed power library. Arcane
workflows usually decide whether a power succeeds, but do not apply the power's actual effect.

## 3. What already works and should be preserved

These are foundations, not gaps:

- Foundry V14.367 document models, ApplicationV2 sheets, registries, migrations, EN/PL parity, and
  the local Playwright gate.
- Exploding Trait/Aptitude rolls, Aces, busts, unskilled checks, TNs, raises, and wound penalties
  (`dlc` p.27-30, p.140).
- A native-card Action Deck bridge with combatant hands, card play, sleeves, Jokers, discard and
  reshuffle primitives (`dlc` p.116-118), subject to the correctness gaps in section 4.
- A concurrency-safe Fate Pot and per-actor chip inventory with pure spending rules (`dlc`
  p.146-148), although only a subset is wired into play.
- Pure damage, armor-step, hit-location, wounds, bleeding, Wind, and Guts helpers (`dlc`
  p.133-144, p.218-222), although most are API-only.
- Huckster casting and poker evaluation, Shaman ritual resolution, Blessed invocation and faith
  denial, Mad Scientist blueprint/construction/reliability, and Harrowed Dominion foundations.
- Player archetypes, NPC and Mook actor types, and the Harrowed overlay architecture.

## 4. Correctness defects to fix before adding broad features

These are not feature wishes. They are current code paths that disagree with the verified source or
break when used in an active combat.

| ID | Current behavior | Required correction | Source | Priority |
|---|---|---|---|---|
| RULE-001 | A successful Quickness roll with no raise deals one card. | Count the base card, the success, and raises; retain the five-card cap and zero cards on a bust. | `dlc` p.116-117 | P0 |
| RULE-002 | `clearHand()` deletes the sleeved card every round. | Keep a sleeve between rounds until played, lost to a Black Joker/Test of Wills, or combat ends. | `dlc` p.117-120 | P0 |
| RULE-003 | `accumulateWounds()` clamps immediately to five and loses excess wounds. | Preserve the pre-clamp wound amount through the Fate-negation transaction, then persist Maimed as the location severity. | `dlc` p.139-140, p.147-148 | P0 |
| RULE-004 | Wind has a schema and input minimum of zero. | Permit negative Wind, derive guts wounds at each negative multiple of maximum Wind, and preserve the winded state. | `dlc` p.141-142 | P0 |
| RULE-005 | Shaman manitou attacks and Harrowed card draws index the Promise returned by `ActionDeck.deal()` during combat. | Await active-combat card deals and add regression tests or a Foundry integration flow. | `ghost-dancers` p.57; `bod` p.62-64 | P0 |
| RULE-006 | Session draws add chips directly and can pass the ten-chip limit without converting surplus to Bounty Points. | Route session grants through one capped transaction and record the conversion. | `dlc` p.146-149 | P0 |

Two related initiative limitations belong in the combat milestone rather than this hotfix set: the
system uses one shared deck instead of one Action Deck per side, and a Red Joker is represented as a
very high numeric initiative rather than a true act-at-any-time choice (`dlc` p.116-118).

## 5. Core rulebook coverage

### Player rules

| Rule area | Current state | Missing for end-to-end play | Source |
|---|---|---|---|
| Basics | **Usable** | Keep the explicitly documented TN 13-19 house-rule choices separate from canon. | `dlc` p.24-31 |
| Character creation | **Manual** | Guided seven-step flow, point budgets, Trait draws/allocation, Aptitude validation, Edge/Hindrance accounting, background and starting gear. | `dlc` p.32-75 |
| Gear and archetypes | **Partial** | Typed armor/gear/ammo models; inventories for weapons, ammunition, ordinary gear, horses and archetypes; price/quantity/weight behavior. | `dlc` p.76-115 |
| Action Deck | **Partial** | RULE-001/002; two-side deck semantics; surprise; action costs; sleeve interrupts; simultaneous ties; complete Joker timing. | `dlc` p.116-118 |
| Movement | **Missing** | Pace/run controls, action cost, running penalties, obstacles, load and mounted movement. | `dlc` p.119 |
| Tests of Wills | **Missing** | Opposed workflow, result states, card/chip consequences, chat and effect duration. | `dlc` p.120 |
| Ranged attacks | **Missing** | Weapon action, target selection, TN/range bands, movement/visibility/size modifiers, RoF, recoil, automatics, shotgun rules, called shots, aiming and quick draw. | `dlc` p.121-127 |
| Duel | **Missing** | Dedicated duel state, secret card buildup, nerve checks, reveal and shot resolution. | `dlc` p.127-128 |
| Reload/throw/bystanders | **Missing** | Ammunition state, reload action costs, jams, thrown attacks and missed-shot bystanders. | `dlc` p.129 |
| Melee/Vamoose | **Missing** | Defense TN, natural/unarmed weapons, multi-action handling, retreat and free-attack workflow. | `dlc` p.130-132 |
| Hit locations | **Partial** | The pure draw helper and table exist; connect raises/called shots to an attack and persist the selected location. | `dlc` p.133-134 |
| Damage and armor | **Partial** | Weapon-to-damage action, Strength damage, vital-location dice, light/layered/AP armor, brawling, massive damage and a preview/confirm transaction. | `dlc` p.135-139 |
| Wounds, stun and Wind | **Partial/Manual** | RULE-003/004; wound assignment, immediate Fate window, Wind roll, stun/recovery actions, unconscious state, per-round bleeding and negative-Wind wounds. | `dlc` p.139-142 |
| Environmental harm | **Missing** | Explosions, drowning, falling, fire/smoke and hanging. Treat as reusable hazard workflows, not one-off chat macros. | `dlc` p.142-143 |
| Healing and death | **Missing** | First aid/golden-hour tracking, Medicine checks per location, natural healing, permanent wounds and death/Harrowed transition. | `dlc` p.144-145 |
| Fate Chips | **Partial** | Red/blue/Legend roll behavior in one action context; wound/Wind negation; Marshal chip inventory and tithe; transfers; ten-chip conversion; BP cash-in. | `dlc` p.146-148 |
| Advancement | **Missing** | Bounty Point ledger, session boundary, Trait/Aptitude costs and limits, new Aptitudes, buying off Hindrances, gaining Edges with Marshal approval. | `dlc` p.149-151 |
| Core Huckster | **Partial** | Populate core Hexes and apply their effects; make backlash consequences persistent. | `dlc` p.154-165 |
| Core Mad Scientist | **Partial** | Populate example Gizmos; apply madness/malfunction consequences and gizmo use effects. | `dlc` p.166-175 |
| Core Blessed | **Partial** | Populate Miracles and execute their actual effects after a successful invocation. | `dlc` p.176-181 |
| Core Shaman | **Partial** | Populate Favors/Rituals, replace conservative ritual baselines, and apply favor effects. | `dlc` p.182-193 |
| Core Harrowed | **Partial** | Return-from-death flow, common/purchased powers, control takeover and Counting Coup. | `dlc` p.194-204 |

### Marshal rules

| Rule area | Current state | Missing for end-to-end play | Source |
|---|---|---|---|
| Fear and Guts | **Partial** | Guts engine is API-only; add a Marshal-triggered check, persistent Scart result/effects, fear-level context and recovery. | `dlc` p.218-222 |
| Tale-Tellin' and awards | **Missing** | Downtime workflow, fear reduction, Fate awards, reason/audit trail and Marshal controls. | `dlc` p.223-225 |
| Mysterious Past/Knacks/Veterans | **Missing** | Tables, creation hooks, item/effect models and veteran budget. | `dlc` p.236-246 |
| Arcane misfires | **Partial** | Some tables roll and report; most results do not create lasting wounds, Wind, Hindrances, madness, possession or disabled powers. | `dlc` p.246-251 |
| Relics | **Missing** | Relic item model, taints/ownership, activation and content. | `dlc` p.255-259 |
| Abominations/Rogue's Gallery | **Missing content** | NPC/critter data models need abilities/terror/armor/attacks; populate the core bestiary and reusable human profiles. | `dlc` p.260-284 |
| Setting and adventure chapters | **Out of scope** | Do not transcribe setting prose or adventures. Support them through generic scene, journal and actor tools only when a real mechanic requires it. | `dlc` p.293-400 |

## 6. Companion-book gap map

Companion depth should follow a stable core combat and effect framework. Otherwise every power
becomes a bespoke implementation and multiplies maintenance cost.

### Hucksters & Hexes

Current: the casting roll, poker-hand evaluator, minimum-hand gate, card draw, and extended backlash
selection exist. The companion module contains only three Hexes.

Missing:

- finding and learning Hexes, Hoyle edition reliability, teachers, and study (`hnh` p.29-34);
- the roughly 55 companion Hex entries and reusable effect handlers (`hnh` p.33-79);
- persistent extended-backlash outcomes rather than chat-only results (`hnh` p.95-102);
- huckster Edges/Hindrances, Tempest, familiars, relics, and magical showdowns (`hnh` p.13-24,
  p.81-94).

### Ghost Dancers

Current: ritual/Appeasement resolution and a manitou-attack branch exist. Favor effects are an
explicit notification-only placeholder, and several ritual values are conservative baselines.

Missing:

- tribe-aware creation, Guardian Spirits and Medicine Ways (`ghost-dancers` p.31-57);
- the complete Favor library and effect handlers (`ghost-dancers` p.57-69);
- exact ritual variants, medicine bundle, group rituals, offerings and repeated-use costs
  (`ghost-dancers` p.70-75);
- medicine objects/sacred objects and their progression (`ghost-dancers` p.79-86);
- optional Hunting Grounds and campaign-facing spiritual travel (`ghost-dancers` p.87-91).

### Fire & Brimstone

Current: Faith invocation, sin resolution, faith-level loss, and time-based Active Effect denial are
wired. Miracle-specific effects are not modeled and the content pack is empty.

Missing:

- faith/religion profiles and their character options (`fb` p.9-27);
- the 40+ Miracles, custom-Miracle support and effect handlers (`fb` p.34-67);
- the 16 Gifts as persistent items/effects (`fb` p.68-75);
- Divine Favor/Intervention as a separate resource and workflow (`fb` p.81-93);
- holy Relics and their restrictions/taints (`fb` p.95-100).

### Smith & Robards

Current: basic blueprint, construction, Reliability, and malfunction-severity workflows exist. No
Gizmo content is supplied and the result generally reports rather than applies an item's effect.

Missing:

- laboratories, libraries, reading blueprints, group research and assistants (`snr` p.12-14);
- elixir research/brewing and resources (`snr` p.23-24);
- the catalog data for conveyances, personal gear, boilers, fuel, elixirs and weapons (`snr`
  p.49-105);
- Research Mishap and Flawed Gizmo effects as persistent state (`snr` p.107-109);
- a vehicle/conveyance model before importing vehicle-heavy catalog entries.

### Book of the Dead

Current: the Harrowed overlay, activation, Dominion values, and session Dominion roll exist. Powers
and Counting Coup are free-text arrays, not selectable mechanical items.

Missing:

- Harrowed creation/return and initial Dominion allocation (`bod` p.10-12);
- seven unique Harrowed Hindrances and their effects (`bod` p.12-15);
- six common powers and 47 purchased powers with level/cost/effect handling (`bod` p.20-60);
- full Dominion control, Marshal takeover duration, and player/Marshal UX (`bod` p.62-64,
  p.79-84);
- Counting Coup acquisition, curse/taint and audit trail (`bod` p.70-78).

## 7. Recommended implementation order

### Milestone A — rules-correct foundation

Deliver RULE-001 through RULE-006 before extending features. Add focused unit tests for pure logic
and Foundry-level coverage for active-combat card draws. This keeps later combat, Shaman, and
Harrowed work from building on invalid state.

Exit criteria:

- all six defects have regression coverage;
- no current world loses wound or sleeve information during a normal round;
- existing 0.4.1 worlds migrate safely if wound/Wind storage changes;
- `npm run verify:ci` passes.

### Milestone B — one complete combat vertical slice

Implement one ranged single-shot attack from weapon click through final persisted damage:

1. select target, skill, TN and modifiers;
2. roll the attack and select/adjust hit location;
3. calculate armor and damage;
4. show pending wounds/Wind before mutation;
5. allow legal Fate Chip prevention;
6. apply wounds, Wind, stun and chat/audit output;
7. tick bleeding and enforce winded combat behavior at the correct round boundary.

Then generalize the same attack context to melee, brawling, RoF/automatic fire, called shots,
reloading, Vamoose, bystanders and massive damage (`dlc` p.121-143). Do not implement each weapon
as its own macro.

Exit criteria:

- a player can resolve a pistol shot without editing an actor field by hand;
- the Marshal sees and can correct the transaction before final application;
- armor, wounds, Wind, Fate prevention, stun and bleeding share one tested state transition;
- two clients cannot double-apply the same attack result.

### Milestone C — complete Action Deck and Fate economy

Add the remaining initiative semantics: two-side decks, surprise, action costs, persistent sleeves,
interrupts, tied actions and true Joker timing (`dlc` p.116-120). Add a persistent Marshal chip
inventory, red tithe, all chip colors, transfers, ten-chip conversion and Bounty cash-in (`dlc`
p.146-149).

Exit criteria:

- cards determine both order and available actions, not just a numeric tracker sort;
- red/blue/Legend spends belong to a single immutable action context;
- Marshal draws are stored, not only printed to chat;
- session start/end preserves player and Marshal chip state.

### Milestone D — character creation and advancement

Build a guided creator on the same Actor data model rather than a second temporary character model.
Track budget changes in a reviewable ledger, require Marshal approval for exceptional changes, and
reuse the ledger for advancement (`dlc` p.32-75, p.149-151).

Exit criteria:

- the seven creation steps can produce every base archetype;
- invalid point totals cannot be finalized accidentally;
- manual override remains available to the Marshal and is visibly marked;
- every BP expenditure records before/after values, cost, source and approver.

### Milestone E — content schema and reusable effect framework

Before bulk population, finish typed models for armor, gear and ammo; introduce explicit effect
handler contracts for damage, modifiers, movement, statuses, resource changes, summons and
GM-adjudicated results. Content entries should contain mechanical data and short original summaries,
never rulebook prose.

Populate in this order:

1. core weapons, armor, ammunition and ordinary gear (`dlc` p.76-82);
2. core Hexes, Miracles, Favors and example Gizmos (`dlc` p.154-193);
3. core abominations and reusable NPC profiles (`dlc` p.260-284);
4. companion content only after its required generic handler exists.

Exit criteria:

- importing content never requires a source-code change for a normal numeric/status effect;
- every entry has source slug/page metadata and no copied prose;
- pack builds are deterministic and coverage counts are audited;
- unsupported bespoke effects say “Marshal adjudication required” instead of pretending to apply.

### Milestone F — finish the five supernatural paths

Use the shared combat/effect/content foundation to close core Huckster, Shaman, Blessed, Mad
Scientist and Harrowed workflows. Then add companion depth in small, book-specific releases.

Recommended sequence: core power content/effects, persistent misfires, Harrowed return/control,
Huckster learning, Shaman Guardian Spirits/Medicine Ways, Blessed Gifts/Intervention, Mad Science
labs/group research/elixirs, then large companion catalogs.

### Milestone G — Marshal and campaign tools

Add a small Marshal dashboard for fear level, group Guts checks, Fate awards, session chip draws,
pending damage approval, NPC generation and status cleanup. Follow with healing/downtime, Tale-Tellin',
Mysterious Past/Knacks/Relics, bestiary tools, mounts and vehicles.

Calendar, merchant, drag-and-drop trade, large setting databases, and prose/adventure imports remain
optional quality-of-life work. They must not block rules completeness.

## 8. Prioritized backlog

| Priority | Work item | Depends on | Smallest useful delivery |
|---|---|---|---|
| P0 | RULE-001 to RULE-006 | None | Correctness patch with migrations/tests |
| P1 | Attack transaction and weapon action | P0 | Single ranged shot end to end |
| P1 | Wound/Wind/Fate/stun/bleeding transaction | P0 | One persisted damage confirmation flow |
| P1 | Full Action Deck action semantics | P0 | Sleeves + action consumption + Joker timing |
| P1 | Full Fate economy and Marshal inventory | Damage transaction | Red/blue/Legend + wound/Wind prevention |
| P1 | Typed armor, gear and ammo | Attack transaction | Core equipment pack can be imported safely |
| P2 | Character creator | Stable actor/item schemas | One valid Cowboy from blank actor to finalized hero |
| P2 | Advancement ledger | Fate/Bounty economy | Raise one Aptitude with validation and audit |
| P2 | Core arcane content/effects | Effect framework | One end-to-end power per supernatural path |
| P2 | Guts/Fear Marshal workflow | Status/effect framework | Group check with persisted outcomes |
| P2 | Core bestiary | Combat + NPC ability schema | One complete abomination encounter |
| P3 | Huckster companion depth | Core Huckster + effects | Learning plus first content batch |
| P3 | Shaman companion depth | Core Shaman + effects | Guardian Spirit plus one Medicine Way |
| P3 | Blessed companion depth | Core Blessed + effects | Gifts plus Divine Favor resource |
| P3 | Mad Science companion depth | Gizmos + vehicles/resources | Labs/group research plus first catalog batch |
| P3 | Harrowed companion depth | Core Harrowed + control UX | Common powers plus Marshal takeover |
| P4 | Campaign conveniences | Stable core | Vehicles, merchant/trade, calendar, generators |

## 9. Definition of done for every mechanic

A work item is complete only when all applicable checks below are satisfied:

1. **Authority:** exact extract pages were read and cited as `<slug> p.NNN`; assumptions and house
   rules are explicitly labeled.
2. **Engine:** rules logic is separated from UI and unit-tested, including bust/failure, raises,
   caps, Jokers, and boundary values.
3. **Data:** persisted fields have a TypeDataModel, validation, ownership rules, and migration from
   the last public schema.
4. **Workflow:** player and Marshal can complete the mechanic without console calls or direct JSON
   editing.
5. **Concurrency:** shared state uses the active-GM operation path and is idempotent across clients.
6. **Feedback:** chat and notifications explain inputs, result, state changes, and any required
   Marshal adjudication.
7. **Localization:** EN and PL keys remain identical; terminology follows the project conventions.
8. **Verification:** relevant unit tests and at least one Foundry E2E path pass, followed by
   `npm run verify:ci`.
9. **Content legality:** source page metadata is stored, mechanical facts are independently phrased,
   and no rulebook prose or art is committed.

## 10. Scope boundary for 1.0

A realistic 1.0 target is **core-rulebook play completeness**, not automation of all six books.
That means a full core character lifecycle, combat, Fate, healing/fear, five supernatural paths,
Harrowed, essential equipment, and enough bestiary content to run encounters. Companion books can
then ship as versioned content/mechanics slices without destabilizing the core.

Hell on Earth, Lost Colony, regional lore, published adventures, and wholesale sourcebook text are
not part of this roadmap. The five audited companion books define expansion opportunities and test
the extensibility of the architecture; they should not redefine the minimum viable core.
