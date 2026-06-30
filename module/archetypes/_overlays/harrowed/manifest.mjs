/**
 * Harrowed overlay manifest — self-registers with OverlayRegistry on import.
 *
 * Harrowed is an overlay (not an actor type): any PC archetype can become
 * Harrowed after dying and drawing a Joker. dlc p.194, bod p.10-12.
 *
 * Adding this import to deadlands-classic.mjs is the only wiring required.
 * No documentTypes.Actor entry is added (see overlay-registry.mjs contract).
 *
 * @license MIT
 */

import { OverlayRegistry } from "../../../core/overlay-registry.mjs";
import { harrowedSchemaFields } from "./data-schema.mjs";
import { activateHarrowed, deactivateHarrowed, dominionRoll } from "./mechanics.mjs";
import { HARROWED_SHEET_PART, HARROWED_SHEET_TAB } from "./sheet-tab.mjs";

OverlayRegistry.register({
  id: "harrowed",
  label: "DEADLANDS.Harrowed.Label",

  // Extra TypeDataModel fields merged into every PC archetype schema.
  // bod p.10-12, dlc p.194-199.
  schemaFields: harrowedSchemaFields,

  // Overlay is active when the character has returned from beyond the pale.
  isActive: (actor) => actor.system.harrowed?.isHarrowed === true,

  // Sheet tab descriptor used by base-character-sheet.mjs.
  sheetTab: { tab: HARROWED_SHEET_TAB, part: HARROWED_SHEET_PART },

  // Mechanics callbacks exposed on game.deadlandsClassic.overlays.get("harrowed").
  mechanics: { dominionRoll, activateHarrowed, deactivateHarrowed },

  // Applies to all PC archetypes (omit = all). bod p.10: "any cowpoke can
  // come back from the dead" regardless of archetype.
});
