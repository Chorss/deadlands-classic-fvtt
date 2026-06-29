# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

### Changed

### Fixed

## [0.1.0] — 2026-06-29

### Added
- **Phases 1–2 — Foundry VTT V14 system scaffold.** `documentTypes`, `TypeDataModel`,
  `ApplicationV2` sheets; `ArchetypeRegistry`, `ItemRegistry`, `OverlayRegistry` plugin
  contracts; `DeadlandsActor` + `DeadlandsItem` base documents; core config constants;
  EN/PL localization foundation (~200 paired keys).
- **Phase 3 — Dice engine.** Exploding-die pool (`rollExplodingPool`), trait roll, damage
  roll with unit tests. Raises calculated as `floor((total − TN) / 5)`.
- **Phase 4 — Click-to-roll.** Trait and aptitude rolls from the character sheet; roll
  dialog (die count, TN, modifier); white chip spend adds a die.
- **Phase 5 — Fate Chips.** Fate Pot world setting (`white / red / blue / legend`);
  chip-rules (spend validation); chip-widget (grant/spend from sheet).
- **Phase 6 — Wounds & Wind.** Full wound track per location (Head, Chest, Guts,
  Left/Right Arm, Left/Right Leg); `woundsFromDamage`, `applyWounds`, `tickBleeding`,
  wound-penalty lookup; Wind calculation; hit-location draw.
- **Phase 6A — Guts check.** Fear-check roll with Scart Table resolution.
- **Phase 7 — NPC & Mook archetypes.** NPC sheet (full trait/wound model); Mook sheet
  (simplified, no individual wound locations).
- **Phase 8 — Action Deck & card initiative.** Native Foundry `Cards` deck;
  `DeadlandsCombat` draws one card per combatant at round start; combat tracker shows
  card labels (suit + rank + joker coloring); hand dialog for multi-card holders.
- **Phase 9 — Huckster archetype.** Hexes item type; poker hand evaluator (full 5-card
  scoring); hex casting with backlash; poker draw from the action deck.
- **Phase 10 — Blessed, Shaman, Mad Scientist archetypes.** Blessed: miracles, sin
  mechanic (Spirit roll on denial); Shaman: favors, ritual roll, Manitou spirit-contest
  check; Mad Scientist: gizmos, blueprint design roll (Cognition), construction roll
  (Deftness), Harrowed Madness Table on failure.
- **CI workflow.** Lint (Biome), unit tests, manifest + EN/PL parity check on every PR
  and `main` push.

### Fixed
- Combat tracker selectors updated for V14 (`.token-initiative > .initiative-input`
  replaces `.combatant-initiative`).
- `CombatantHandDialog` and initiative-value path corrections after V14 runtime testing.
- Multiple V14 API compatibility fixes across archetype sheets and mechanics.

[Unreleased]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.1.0...HEAD
[0.1.0]: https://github.com/Chorss/deadlands-classic-fvtt/releases/tag/0.1.0
