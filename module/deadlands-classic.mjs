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
import { ActionDeck } from "./core/cards/action-deck.mjs";
import { CombatantHandDialog } from "./core/cards/combatant-hand-dialog.mjs";
import { DeadlandsCombat } from "./core/cards/deadlands-combat.mjs";
import { DeadlandsCombatant } from "./core/cards/deadlands-combatant.mjs";
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

// Core item type registrations (edge, hindrance). Archetype-specific types
// (hex, miracle, favor, gizmo) are registered by their archetype manifests.
import "./core/items/core-items-manifest.mjs";

// Archetype manifests self-register on import. Adding an archetype = one line here.
import "./archetypes/cowboy/manifest.mjs";
import "./archetypes/huckster/manifest.mjs";
import "./archetypes/blessed/manifest.mjs";
import "./archetypes/shaman/manifest.mjs";
import "./archetypes/mad-scientist/manifest.mjs";
import "./archetypes/npc/manifest.mjs";
import "./archetypes/mook/manifest.mjs";

// Overlay manifests self-register on import. Overlays add NO documentType —
// they contribute schema fields and a conditional sheet tab. dlc p.194.
import "./archetypes/_overlays/harrowed/manifest.mjs";

const SYSTEM_ID = "deadlands-classic";
const LOG_PREFIX = `${SYSTEM_ID} |`;

Hooks.once("init", () => {
  console.log(`${LOG_PREFIX} Initializing`);

  // Handlebars helpers — capitalize first letter of a string.
  Handlebars.registerHelper("capitalize", (str) =>
    typeof str === "string" && str.length > 0 ? str[0].toUpperCase() + str.slice(1) : str
  );

  // Document classes.
  CONFIG.Actor.documentClass = DeadlandsActor;
  CONFIG.Item.documentClass = DeadlandsItem;
  CONFIG.Combat.documentClass = DeadlandsCombat;
  CONFIG.Combatant.documentClass = DeadlandsCombatant;

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
    cards: { ActionDeck, CombatantHandDialog, DeadlandsCombat, DeadlandsCombatant },
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

// ── Combat tracker — replace numeric initiative values with card labels ──────

function _renderInitiativeLabel(row, combatant) {
  const initContainer = row.querySelector(".token-initiative");
  if (!initContainer) {
    return;
  }
  const card = combatant.highestCard;
  if (!card) {
    return;
  }

  const input = initContainer.querySelector(".initiative-input");
  if (input) {
    input.style.display = "none";
  }

  let label = initContainer.querySelector(".dlc-initiative-label");
  if (!label) {
    label = document.createElement("span");
    label.classList.add("dlc-initiative-label", "dlc-initiative-card");
    initContainer.appendChild(label);
  }
  label.textContent = DeadlandsCombat.cardLabel(card);
  label.classList.toggle("dlc-initiative-red-joker", card.joker === "red");
  label.classList.toggle("dlc-initiative-black-joker", card.joker === "black");
}

function _renderHandButton(row, combatant) {
  const canSee = game.user.isGM || combatant.actor?.isOwner;
  if (!canSee || !combatant.hand.length) {
    return;
  }
  const controls = row.querySelector(".combatant-controls");
  if (!controls) {
    return;
  }

  const btn = document.createElement("a");
  btn.classList.add("dlc-hand-btn");
  btn.setAttribute("aria-label", game.i18n.localize("DEADLANDS.Combat.Hand.Open"));
  btn.title = game.i18n.localize("DEADLANDS.Combat.Hand.Open");
  btn.innerHTML = '<i class="fas fa-hand"></i>';
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    CombatantHandDialog.open(combatant);
  });
  controls.prepend(btn);
}

Hooks.on("renderCombatTracker", (_app, html) => {
  const combat = game.combat;
  if (!combat) {
    return;
  }
  for (const combatant of combat.combatants) {
    const row = html.querySelector(`[data-combatant-id="${combatant.id}"]`);
    if (!row) {
      continue;
    }
    _renderInitiativeLabel(row, combatant);
    _renderHandButton(row, combatant);
  }
});
