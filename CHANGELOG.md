# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Local Playwright E2E suite (`tests/e2e/`, `npm run test:e2e`) driving a real
  Foundry instance: boot smoke, per-archetype sheet render (raw-i18n-key leak
  check), click-to-roll flow, and a two-client GM-proxy race regression.
  Local-only by design — CI cannot run licensed Foundry. Setup and usage:
  `docs/testing-e2e.md`.
- `npm run verify:all` — one definition of "green" (manifest + EN/PL parity →
  CSS coverage → i18n keys → unit tests), now shared by CI, the pre-commit hook
  and the `/verify-system` skill. `tools/audit-i18n.mjs` was previously wired
  into nothing and never ran outside a manual invocation.
- `Stop` hook (`.claude/hooks/stop-verify.sh`) — runs `verify:all` before Claude
  ends a turn with a dirty working tree. This is the only check that covers files
  written through Bash (`sed -i`, heredocs, `>` redirection), which bypass the
  `PostToolUse` `Write|Edit` hook entirely.
- Enforced deny rules for `vendor/`, `books/`, `.pdf-extract/` and `LICENSE` —
  previously prose in `CLAUDE.md` with nothing behind it.
- Pre-commit branch running `audit-i18n` when `.mjs`, `.hbs` or `lang/` files
  are staged.
- `tools/audit-css.mjs` scans `module/**/*.mjs` alongside `templates/**/*.hbs`.
  21 `dlc-*` classes are built in chat-card template literals and were invisible
  to the audit. `templates/` stays a hard error; `module/` reports as a warning
  while a backlog of 9 classes with no CSS rule at all (the Guts-check card) is
  worked off, and flags anything added beyond it.
- Dead-selector report in `audit-css` — selectors defined in `styles/` but used
  nowhere (currently 14). Informational only, never affects the exit code.
- Pre-commit runs `audit-css` on `.mjs` changes too, so a new class introduced in
  JavaScript no longer slips past the gate.
- `audit-css` collects bare `"dlc-*"` string literals in `module/`, catching the
  classes applied through `classList.add()` and `DEFAULT_OPTIONS.classes`
  (`dlc-initiative-*`, `dlc-hand-btn`, `dlc-hand-dialog`, `dlc-winded`) that never
  appear inside a `class="…"` attribute.
- CSS rules for the six template classes the audit could not previously see:
  `dlc-unskilled`, `dlc-constructed`, `dlc-joker`, `dlc-joker-card`,
  `dlc-card--joker`, `dlc-card--black`. The joker highlight in drawn-card lists and
  the initiative hand had no styling at all.

### Changed

- **M5.3 of the Ledger redesign: the Mad Scientist Gizmos tab.** No README
  pattern for this archetype — composed from the Hexes-tab (M5.1) primitives:
  section-heads, an inline Mad Science/Tinkerin' stat row, and the gizmo list
  as a grid table matching the hex table's shape. Status badges
  (Constructed/Devised/Failed/Not started) move off the bespoke
  `.dlc-status`/`-status-*` rules onto the shared `.dlc-pill` primitive (new
  `-muted` variant added for the neutral state), giving `.dlc-pill-brass` and
  `.dlc-pill-green` their first consumers since M1 and retiring a rule that
  duplicated `.dlc-pill`'s concept under a different name.
- **M5.2 of the Ledger redesign: the Harrowed overlay tab.** Plum double-rule
  masthead with a toggle-switch for Is Harrowed (still a native checkbox
  underneath — no new state plumbing); Dominion/Powers/Counting Coup each get
  the `.dlc-section-head` treatment; Powers and Counting Coup become
  dotted-leader prose rows with the power's kind as a `.dlc-pill-plum` badge.
  Consolidated a README-flagged duplicate: `.dlc-outcome-*`/`.dlc-last-roll-*`
  were defined in both `item-sheet.css` and `archetypes/harrowed.css` — the
  latter already won the cascade (it `@import`s later) and was the only one
  actually read by `harrowed-tab.hbs`, so the `item-sheet.css` copy was dead
  weight, now removed.
- **M5.1 of the Ledger redesign: the Huckster Hexes tab.** Section-head +
  hairline for Hexslingin' and the hex list; a "Backlash pending" pill
  (`.dlc-pill-blood`) instead of a bespoke warning line; inline Level/Modifier
  stats; the hex list becomes a grid table (Hex/Trait/Hand/Spd/Duration/Range/
  Cast) with the Cast button now the shared `.dlc-btn-primary`. Fixed a latent
  bug found along the way: the hex-cast chat card's red/black joker colouring
  was a `data-joker`/`data-suit` attribute selector that never matched the
  card's actual class-based markup, so it silently never rendered — now fixed
  to target the classes the template sets. Also separated the hex-cast card's
  `.dlc-card` from the Combatant Hand dialog's identically-named class (the
  two were accidentally sharing one rule in `huckster.css`, so a Huckster's
  drawn-card style was leaking into every archetype's hand dialog); the
  hex-cast card is now `.dlc-hex-card`, and the generic dialog rules moved to
  `dialogs.css` where they belong.
- **M4 of the Ledger redesign: chat cards and the combat tracker.** Every
  outcome class (`trait-roll.mjs`, `damage-roll.mjs`, `guts-check.mjs`,
  `harrowed/mechanics.mjs`, the Fate Pot chip-draw card) is now a bare state —
  `success`/`bust`/`failure`/`damage`/`arcane` — instead of a `dlc-`-prefixed
  name, matching the `.dlc-rail-item.active` convention from M3. `dlc-night`
  moves from the M1 sidebar stopgap onto every chat card directly (JS-built
  and the 7 `templates/chat/*.hbs` cards alike), so `_variables.css`'s night
  block now targets only `.dlc-night`. `chat.css` is rewritten to paint each
  card's own background/border/padding and derive its outcome accent from the
  bare state class. The combat tracker's Foundry-injected elements (initiative
  label, hand-open button) carry `dlc-night` themselves, since nothing in
  Foundry's own sidebar row supplies it. New Marshal-only Fate Pot widget
  (`FatePotWidget`, `game.settings.registerMenu`) gives the session-draw and
  pot-refill operations — previously console/macro-only — an actual UI, with
  a confirmation prompt in front of the destructive refill. `audit-css`'s
  module backlog drops from 15 entries to one deliberate exception
  (`dlc-hand-dialog`, deferred to M6's dialog redesign).
- **M3 of the Ledger redesign: the character sheet's actual layout, not just
  its tokens.** Masthead rebuilt around a 3px double rule (portrait + Rye name
  + Cinzel archetype line, sourced from Foundry's own `TYPES.Actor.<type>`
  label); Fate Chips move from the Combat tab into the header as
  `.dlc-chip-token` discs. The tab bar restyles into a Cinzel rail
  (`.dlc-rail`/`.dlc-rail-item`) — icons dropped, `tabs` kept on the `<nav>`
  since ApplicationV2's native `changeTab()` depends on it for active-tab
  highlighting. Traits render as read-only "4d8 +2" notation with dotted
  leaders by default; a new whole-sheet edit-mode toggle (header) reveals the
  raw die-count/type/modifier controls, which stay in the DOM at all times so
  ApplicationV2's form submission never drops a path. Wounds get 5-segment
  severity bars driven by `data-severity` (colour ramp was already aliased in
  CSS from M1, never wired to markup until now) plus a penalty stamp; the Wind
  meter gets an 18-tick fuel-gauge bar alongside the still-directly-editable
  value (`buildWindTicks`, `wind-calculator.mjs`, unit-tested). Gear and
  Weapons become run-in prose ("WEAPONS — Colt Peacemaker; Winchester '73.")
  instead of item lists. NPC and Mook sheets shrink to a 460px compact window
  with single-column traits.
- **M2 of the Ledger redesign: `styles/chips.css` is gone.** Its rules were
  duplicates of what the new tokens already cover, kept alive only by import
  order. Fate-chip primitives moved to `combat.css` (rebuilt on the
  `--dlc-chip-*` triples from M1 instead of four hardcoded hex colours), the
  roll dialog's shell to `dialogs.css`, the trait/aptitude roll-button reset to
  `actor-sheet.css`, and the JS-built roll-result card (`trait-roll.mjs`,
  `damage-roll.mjs`, `guts-check.mjs`) to `chat.css`. `.dlc-unskilled-warn` had
  two conflicting definitions (`_base.css` vs the old `chips.css`); only one
  survives.
- **Ledger design tokens replace the old palette** (milestone M1 of the visual
  redesign). `styles/_variables.css` now carries parchment surfaces for windows,
  a night block for the sidebar, semantic accents, a five-step wound ramp,
  fate-chip triples and a four-face type scale. The nine bundled `@font-face`
  blocks are unchanged.
- All 94 references to the retired `--dlc-color-*` and `--dlc-pip-{light,serious,
  maimed,empty}` tokens were rewritten across the eleven component sheets. The
  mapping is not 1:1 — the old names mixed role with value, so `--dlc-color-gold`
  became `--dlc-brass`, `--dlc-color-muted` became `--dlc-ink-muted`, and the two
  pre-baked `*-dim` alphas became `color-mix()` against the accent they tinted.
  `--dlc-sheet-gap` and `--dlc-pip-size` keep their names; the design has no
  counterpart for either.
- Base primitives (`styles/_base.css`) rebuilt on the new tokens. All ten
  existing classes keep their selectors, joined by thirteen helpers
  (`.dlc-section-head`, `.dlc-block-end`, `.dlc-num`, the button variants, the
  `.dlc-pill` family) that have no markup yet and so appear in the informational
  dead-selector list until the layout lands.
- Actor sheets and system dialogs paint their window from the parchment tokens.
  Foundry's `.application` frame reads `--background`, `--color-border` and
  `--color-text-primary`, so the sheet root re-points those rather than
  restyling the chrome; the title bar is left to Foundry.
- Chat and roll cards render on Foundry's dark sidebar but do not carry
  `.dlc-night` yet, so the night token block also matches `.dlc-chat-card` and
  `.dlc-roll-card`. That stopgap is removed once the class reaches the markup.
- Slash commands migrated to skills: `.claude/commands/*.md` →
  `.claude/skills/<name>/SKILL.md`, with `argument-hint` added for `release`,
  `new-phase` and `add-archetype`.
- `.claude/rules/` is now loaded natively by Claude Code instead of through
  `@`-includes in `CLAUDE.md`. `code-quality.md` gained a `paths:` scope, so its
  164 lines no longer load in sessions that never touch JavaScript.
- Workshop docs (`CLAUDE.md`, `.claude/README.md`) rewritten to describe the
  mechanisms that actually run, including which permission rules are enforced
  and which are only a speed bump.
- Biome now covers `styles/**/*.css` (`files.includes`), which previously checked
  zero lines of CSS. `npm run fmt` reformatted 7 style files — whitespace only,
  plus `rgba(0,0,0,.4)` → `rgba(0,0,0,0.4)`.

### Fixed

- Focus ring contrast. The indicator was hardcoded `#c8a44b`, which measures
  1.9:1 against the parchment window and fails WCAG AA. It now uses
  `--dlc-ink` (14:1 on the window bar, 15.4:1 on the sheet body) and flips to
  brass on night surfaces.
- `.claude/hooks/post-write.sh` exits 2 instead of 1 on a validation failure.
  `PostToolUse` surfaces hook stderr to Claude only on exit code 2, so every
  syntax and JSON check it performed was invisible to the model.
- `.claude/hooks/post-extract-verify.sh` no longer spawns node processes on
  unrelated Bash calls; a native `if: Bash(*extract-pdf.sh *)` filter gates it.
- Dropped the redundant `.deadlands-classic.sheet :focus-visible` selector, which
  tripped `lint/style/noDescendingSpecificity` and was already covered by the
  `.deadlands-classic :focus-visible` selector sharing its rule. No visual change.
- `audit-css` no longer loses classes written inside a Handlebars block. Splitting
  `class="dlc-wound {{#if x}}dlc-maimed{{/if}}"` on whitespace left `dlc-maimed`
  glued to `{{/if}}`, so it counted as neither used nor dynamic. Six template
  classes with no CSS rule were passing the "hard error" gate, and 8 of the 14
  reported dead selectors were live all along.
- `audit-css` strips CSS comments before harvesting selectors. A class merely
  *named* in a comment counted as defined, which both polluted the dead-selector
  list and let a template use it with no rule behind it.
- `MODULE_BACKLOG` is a frozen set of names rather than a count, so styling one
  backlog class while adding another unstyled one no longer cancels out unnoticed.
- Removed the dead `.dlc-wind-label` rule (`header.hbs` uses `.dlc-stat-label`) and
  corrected a `blessed.css` comment naming a sin-severity vocabulary that does not
  exist (`light`/`heavy`; the real values are `minor`/`major`/`mortal`).

## [0.3.4] — 2026-07-06

### Added

- `tools/audit-i18n.mjs` (`npm run audit:i18n`) — flags `DEADLANDS.*` keys used
  in `module/` or `templates/` that don't exist in `lang/en.json`, the gap that
  `verify-documenttypes.mjs` (EN/PL parity only) can't catch.
- GM-proxy for shared-state writes (`module/core/gm-proxy.mjs`): Fate Pot and
  Action Deck mutations are dispatched as pure JSON op descriptors to the
  single active GM client over Foundry's native Queries API (`CONFIG.queries`
  + `User#query`) and applied there through the existing `KeyedAsyncQueue` —
  one serialized writer for the whole world. With no GM online the operation
  is rejected with a localized warning (no local fallback).

### Changed

- Removed the dead `wound-locations-widget.hbs` partial (never rendered — all
  archetypes use the combat-tab wound list) with its widget-only CSS, and the
  unused `DEADLANDS.Wound.{Applied,BleedingTick,MaimedLimb,WindRecovered}` and
  `DEADLANDS.Combat.Initiative.{Label,Deal}` i18n keys.
- `FatePot.patch` prefers a plain patch object (an updater function can't cross
  the GM query wire). The updater form is still accepted as a **deprecated**
  compat shim — it runs locally against a snapshot and logs a compatibility
  warning; prefer `returnToPool` / `discard` / `drawBlind` for read-dependent
  changes.
- README: structured the Screenshots section (planned captures in
  `assets/screenshots/`, shipped in the release zip once present) and dropped
  the stale version qualifier from the feature-status heading.
- `ActionDeck.initialize` returns an `{ok, cardsRemaining}` summary instead of
  the full deck state, so the draw-pile order never crosses the wire.
- The four copies of the white-chip spend-then-roll block (trait, aptitude, hex,
  miracle) are consolidated into the single `runWithWhiteSpend` helper, so trait
  and aptitude rolls now get the same refund-on-failure protection as casts.

### Fixed

- **Fate Chips — "No Going Back"** (dlc p.148): `canSpend()` allowed unlimited
  white chips even after a red, blue, or Legend chip had already been spent on
  the same action. Added the missing gate and corrected the unit test that had
  locked in the wrong behavior.
- **Joker Fate-Chip draws are posse-only** (dlc p.118): a Red or Black Joker
  drawn by the Marshal's own NPC no longer grants a chip — the Red Joker draw
  is the drawing player's only, and the Black Joker's chip penalty applies only
  when a player drew it. Extracted a pure, unit-tested `resolveJokerOutcome()`.
- **Damage — Armor die-type reduction** (dlc p.136): `rollDamage()` only ever
  applied Armor as a flat subtraction; the die-type step-down that heavy Armor
  actually performs (e.g. 3d6 vs Armor 2 → 2d4) was an unimplemented
  placeholder. It now takes `armorLevel` (die-type/count reduction) and
  `lightArmorValue` (Light Armor flat subtraction) separately and applies them
  in the correct order. The pure math is unit-tested against the rulebook's own
  worked examples.
- **Localization**: chat-card strings that were hardcoded in English — the
  Aces tooltip, the "vs TN" total label (trait and Guts rolls), the damage
  Armor reduction, and the "Marshal" session-draw label — now go through
  `game.i18n` with EN/PL keys.
- **Player-initiated chip spends and card deals failed server-side** — world-
  setting writes require `SETTINGS_MODIFY` (default Assistant+) and Combat-flag
  writes are GM-only, so every spend/deal from a player client was rejected by
  the server (chip vanished from the actor, pot never updated). Now routed
  through the GM proxy.
- **Fate Pot / Action Deck cross-client race** — two clients writing the same
  world setting or combat flag simultaneously could lose a chip or duplicate a
  dealt card; the GM proxy serializes all writers (closes the follow-up in
  `docs/notes.md`).
- Chip spends now write the pot **before** deducting the actor's chips, so a
  rejected pot write (e.g. no GM online) can no longer vanish a chip; roll
  flows abort cleanly when the spend fails.
- **GM-op retries no longer double-apply.** A `User#query` timeout expires only
  the caller's ack while the GM keeps running the handler, so the old
  "nothing was changed — try again" message was false and a retry re-applied
  the op. Each dispatch now carries a stable `opId`, handlers run through an
  `OpDedupCache` on the GM client (retry collapses onto the first run), and the
  query is retried once automatically. The `QueryFailed` message no longer
  claims nothing changed.
- **Silent GM-local failures now notify.** A failed op on the GM's own client
  (the `gm.isSelf` path) previously threw with no user feedback, while the chip
  spend/`tryWhiteSpend` catch blocks assumed the proxy had already notified. The
  GM-local path now surfaces the same error notification as the remote path.
- **Fate Pot ops are authorized per requesting user.** Only `reset` was GM-gated;
  a player could `patch` the whole pot to zero or `drawBlind` it dry from the
  console. The GM client now runs `assertFatePotOpAuthorized` before applying any
  op — `reset`/`patch` are GM-only, a player's blind draw is capped at one chip
  (Tithe/Joker), and returns/discards can't exceed the per-actor chip cap.
- **Red-chip spend is now atomic.** Spending a red chip was two separate GM ops
  (return-to-pool, then the Marshal's Tithe draw); if the second failed, the pot
  kept the returned chip with no matching draw and a retry inflated it further.
  A single `spendWithTithe` op does both in one GM-side write.
- **Chip deduction no longer clobbers a concurrent grant.** `executeSpend` /
  `executeWhiteSpend` wrote the actor's new chip count from a snapshot taken
  before the GM round trip, so a chip the Marshal granted mid-spend was silently
  overwritten. The write is now a delta off a fresh read taken right before it.
- **A failed hex/miracle no longer eats white chips.** Casting a hex or invoking
  a miracle spent the white chips *before* the GM-routed card deal, so a deal
  that timed out or found no GM cost the player chips with no roll and leaked an
  unhandled rejection. Both flows now run through `runWithWhiteSpend`, which
  refunds the chips and notifies when the follow-up action throws.
- **Action Deck no longer deals duplicate cards.** When the draw pile ran short
  mid-round it was topped up with a whole fresh 54-card deck, so a card already
  in a combatant's hand could be dealt again to another. Per dlc p.116 the deck
  now recycles its own played (discard) pile back into the draw stock; a full
  reshuffle is still reserved for the Black Joker. Round end retires the played
  cards to the discard pile.

## [0.3.3] — 2026-07-01

### Changed

- Deduplicated the local `_toPascal` reimplementations in the Huckster,
  Shaman, and Mad Scientist archetypes into the shared `core/utils.mjs`
  `toPascal`.
- Deduplicated the Fate Pot / Action Deck promise-chain mutex into a shared
  `core/async-queue.mjs` `KeyedAsyncQueue`, which also prunes idle per-key
  entries instead of growing `ActionDeck`'s per-combat map unboundedly.

### Fixed

- **Dominion Roll** (Harrowed) threw for every character — `rollExplodingPool`
  was called with an options object instead of positional arguments.
- **Roll Trait/Aptitude** threw for NPC and Mook actors, which have no
  `system.chips` in their schema.
- The **Harrowed sheet tab** silently disappeared for Huckster, Shaman,
  Blessed, and Mad Scientist characters — `ApplicationV2` doesn't merge
  `static PARTS`/`TABS` across the class hierarchy the way it does
  `DEFAULT_OPTIONS`, so each archetype's full override dropped the tab.
- **Blessed sin/faith-denial** was never enforced — a character denied by
  their patron could still invoke miracles freely; the denial-expiry field
  was never written. Now a hard block per fb p.103-104, lifted automatically
  once `game.time.worldTime` passes the computed expiry.
- **White-chip overspend** — a stale dialog value greater than the actor's
  real white-chip count granted free extra dice with no error. Now clamped
  to the actual chip count before rolling.
- **Fate Pot / Action Deck race condition** — overlapping async read-modify-
  write calls on the same client could silently lose a chip or duplicate a
  dealt card. Serialized via a promise-chain mutex.
- **White-chip spend used a stale pre-dialog count** — Roll Trait, Roll
  Aptitude, Cast Hex, and Invoke Miracle all captured the actor's white-chip
  count before showing the (async) roll dialog, then wrote that stale value
  back on submit, silently clobbering any chip change made while the dialog
  was open. Spent white chips were also never returned to the Fate Pot,
  contradicting dlc p.26. Both now go through a single `executeWhiteSpend`
  helper that reads the live count and returns spent chips to the pot.
- **Guts wound-pool consolidation** (tracked in `docs/notes.md`) — gizzards,
  upper guts, and lower guts were three independent severity pools, so damage
  could be spread across them to dodge the Maimed threshold, contradicting
  dlc p.139. Now pooled (capped at 5) for wound-penalty purposes.
- **Bleeding drain (`tickBleeding`) ignored the guts pool** — after the guts
  wound-pool consolidation above, bleeding was still computed per individual
  guts sub-location, so a pooled Critical/Maimed guts wound could drain 0
  Wind per round instead of the correct amount. Now uses the shared pool
  (dlc p.142).
- Hardcoded, non-localized sin-denial duration strings in the Blessed
  archetype.
- Trait/Aptitude chat cards didn't identify which actor rolled.
- An unhandled promise rejection if the initial `wind.value` update failed
  on actor creation.

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

[Unreleased]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.3.4...HEAD
[0.3.4]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.3.3...0.3.4
[0.3.3]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.3.2...0.3.3
[0.3.2]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.3.1...0.3.2
[0.3.1]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.3.0...0.3.1
[0.3.0]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/Chorss/deadlands-classic-fvtt/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/Chorss/deadlands-classic-fvtt/releases/tag/0.1.0
