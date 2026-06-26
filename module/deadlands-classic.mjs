/**
 * Deadlands Classic — Community Edition
 * Entry point. Registers the document classes and data-model registries, and
 * exposes the public `game.deadlandsClassic` API. Subsystem wiring (dice, cards,
 * chips, wounds) and the per-archetype manifests are added in later phases.
 *
 * @see https://github.com/Chorss/deadlands-classic-fvtt
 * @see docs/implementation-plan.md §11 (Phase 1)
 * @license MIT
 */

import { ArchetypeRegistry } from "./core/archetype-registry.mjs";
import { canSpend, executeSpend } from "./core/chips/chip-rules.mjs";
import { grantChips, spendChip } from "./core/chips/chip-widget.mjs";
import { FatePot } from "./core/chips/fate-pot.mjs";
import { DEADLANDS } from "./core/config.mjs";
import { rollDamage } from "./core/dice/damage-roll.mjs";
import { rollExplodingPool } from "./core/dice/exploding-roll.mjs";
import { lookupScart, rollGutsCheck, scartDiceForTN } from "./core/dice/guts-check.mjs";
import { rollTrait } from "./core/dice/trait-roll.mjs";
import { DeadlandsActor } from "./core/documents/deadlands-actor.mjs";
import { DeadlandsItem } from "./core/documents/deadlands-item.mjs";
import { ItemRegistry } from "./core/item-registry.mjs";
import { OverlayRegistry } from "./core/overlay-registry.mjs";
import { drawHitLocation, resolveHitLocation } from "./core/wounds/hit-location.mjs";
import {
  computeWindMax,
  gutsWoundsFromNegativeWind,
  isWinded,
} from "./core/wounds/wind-calculator.mjs";
import {
  applyWounds,
  getBleedingRate,
  highestWoundPenalty,
  tickBleeding,
  woundsFromDamage,
} from "./core/wounds/wound-track.mjs";

// Archetype manifests self-register on import. Adding an archetype = one line here.
import "./archetypes/cowboy/manifest.mjs";

const SYSTEM_ID = "deadlands-classic";
const LOG_PREFIX = `${SYSTEM_ID} |`;

Hooks.once("init", () => {
  console.log(`${LOG_PREFIX} Initializing`);

  // Document classes.
  CONFIG.Actor.documentClass = DeadlandsActor;
  CONFIG.Item.documentClass = DeadlandsItem;

  // Type data models from the registries. Empty in Phase 1 — archetype and item
  // manifests populate these as they are imported in later phases.
  CONFIG.Actor.dataModels = ArchetypeRegistry.dataModels();
  CONFIG.Item.dataModels = ItemRegistry.dataModels();

  // Per-archetype actor sheets, sourced from the registry.
  for (const def of ArchetypeRegistry.all()) {
    foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, def.sheetClass, {
      types: [def.id],
      makeDefault: true,
      label: def.label,
    });
  }

  // Fate Pot world setting (4 integers — NOT Cards). dlc p.146. Plan §3.3.
  FatePot.registerSetting(SYSTEM_ID);

  // World-data migration version — seeded from day one so future schema changes
  // can run a guarded migration in `ready` without breaking existing worlds (plan §8).
  game.settings.register(SYSTEM_ID, "migrationVersion", {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });

  // Public system API — the single entry point for sheets, macros and modules.
  // Subsystem slots are declared up front for a stable shape; they are wired in
  // their respective phases (dice → 3, cards → 8, chips → 5, wounds → 6).
  game.deadlandsClassic = {
    id: SYSTEM_ID,
    config: DEADLANDS,
    archetypes: ArchetypeRegistry,
    items: ItemRegistry,
    overlays: OverlayRegistry,
    dice: { rollExplodingPool, rollTrait, rollDamage, rollGutsCheck, lookupScart, scartDiceForTN },
    cards: null,
    chips: {
      FatePot,
      canSpend,
      executeSpend,
      grantChips,
      spendChip,
      drawForSession: FatePot.drawForSession.bind(FatePot),
    },
    wounds: {
      woundsFromDamage,
      applyWounds,
      tickBleeding,
      getBleedingRate,
      highestWoundPenalty,
      drawHitLocation,
      resolveHitLocation,
      computeWindMax,
      isWinded,
      gutsWoundsFromNegativeWind,
    },
  };
});

Hooks.once("ready", () => {
  console.log(`${LOG_PREFIX} ${game.i18n.localize("DEADLANDS.System.Loaded")}`);
});
