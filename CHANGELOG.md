# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

### Changed

### Fixed

## [0.3.2] — 2026-07-01

### Fixed
- `system.json` reformatted with Biome after the 0.3.1 version bump (inline
  arrays were left multi-line, causing `biome check` drift).

### Changed
- `/release` skill now re-runs Biome format on `system.json` after bumping
  the version, preventing the same drift in future releases.
- Pre-commit hook now runs `biome check` in addition to existing checks.

## [0.3.1] — 2026-06-30

### Added
- Offline display-font picker in system settings — choose from Rye, Arvo,
  Cinzel, or system default; all fonts bundled locally (no CDN dependency).
- Full CSS layer — actor sheet, wounds, and archetype sections fully styled.

### Fixed
- Font-picker correctness and code-quality issues.
- `system.json` `htmlFields` arrays reformatted inline (Biome format).

### Changed
- `audit-css.mjs` added — enforces `dlc-*` class coverage between templates
  and stylesheets; Biome lint/format applied.

## [0.3.0] — 2026-06-30

### Fixed
- **Phase 13 — Localization audit complete.** All `localize()` call-sites
  verified; PL terminology aligned with MAG translation canon across all
  archetypes ("Kanciarz", "Świątobliwy", "Wygrzebany", "Szton Losu", etc.);
  `verify-documenttypes` confirms full EN/PL key parity.
- Correct Shaman Medicine Way i18n keys to match *Ghost Dancers* p.58.
- Initialise `wind.value` to `wind.max` on first actor creation (was left at 0).
- WCAG AA accessibility pass — sepia/red contrast ratios corrected, keyboard
  navigation, `aria-label` on body-location icons and chip widget.

### Changed
- Add `.playwright-mcp/` and root `*.png` to `.gitignore`.

### Documentation
- `README.md`: "Development Tooling" section (PhpStorm, Claude Code, Biome,
  node:test); link to `CHANGELOG.md` in Contributing section.

## [0.2.0] — 2026-06-30

### Added
- **Phase 11 — Harrowed overlay.** Any PC archetype can become Harrowed (dlc p.194, bod p.10-12).
  Extra schema fields (`isHarrowed`, `dominion`, `harrowedPowers`, `countingCoup`) are merged into
  every PC actor via `OverlayRegistry`. A "Harrowed" tab appears on the sheet when active.
  Dominion Roll (`resolveDominionRoll`) is pure and fully unit-tested. EN/PL localization uses
  "Wygrzebany" / "Dominacja" from the MAG Polish canon.
- **Phase 12 — Content packs.** `hindrances-srd` (58 entries from dlc p.52-62, with exact PDF-verified
  names: "Yeller" not "Yellow", "Geezer" not "Elderly"); `edges-srd` expanded to 31 entries from
  dlc p.63-70 (Level-Headed, Nerves o' Steel, Arcane Background, etc.); `hit-location` RollTable (1d20,
  dlc p.133); `archetype-examples` pack (one example actor per archetype).
  New item data models: `EdgeDataModel`, `HindranceDataModel` (point-based, 1–5, matching dlc's
  system instead of Minor/Major). Core item types registered in `ItemRegistry`.
- **Phase 14 — Tooling & docs.** `verify-documenttypes.mjs` now cross-checks `documentTypes`
  against static `ArchetypeRegistry` / `ItemRegistry` call-sites. `docs/architecture.md` extended
  with dependency diagram, public API table, and SemVer policy. `docs/extending-archetypes.md`
  (step-by-step tutorial for new archetypes). `docs/migration-policy.md` and
  `tests/migration.test.mjs` (world-data migration contract).

### Fixed
- Sync `package.json` version to `0.2.0` (was incorrectly left at `0.1.0`).

### Changed
- `system.json` and `package.json` versions bumped to `0.2.0`.

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

[Unreleased]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.3.2...HEAD
[0.3.2]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.3.1...0.3.2
[0.3.1]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.3.0...0.3.1
[0.3.0]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/Chorss/deadlands-classic-fvtt/releases/tag/0.1.0
