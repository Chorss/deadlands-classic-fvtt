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
import { DEADLANDS } from "./core/config.mjs";
import { DeadlandsActor } from "./core/documents/deadlands-actor.mjs";
import { DeadlandsItem } from "./core/documents/deadlands-item.mjs";
import { ItemRegistry } from "./core/item-registry.mjs";
import { OverlayRegistry } from "./core/overlay-registry.mjs";

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

  // Public system API — the single entry point for sheets, macros and modules.
  // Subsystem slots are declared up front for a stable shape; they are wired in
  // their respective phases (dice → 3, cards → 8, chips → 5, wounds → 6).
  game.deadlandsClassic = {
    id: SYSTEM_ID,
    config: DEADLANDS,
    archetypes: ArchetypeRegistry,
    items: ItemRegistry,
    overlays: OverlayRegistry,
    dice: null,
    cards: null,
    chips: null,
    wounds: null,
  };
});

Hooks.once("ready", () => {
  console.log(`${LOG_PREFIX} ${game.i18n.localize("DEADLANDS.System.Loaded")}`);
});
