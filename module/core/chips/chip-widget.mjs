/**
 * Chip widget helpers — thin UI bridge between sheet actions and chip-rules.
 *
 * Full spend/grant buttons are wired in the sheet actions (Phase 5). This module
 * provides the context-builder used by both BaseCharacterSheet and future archetype
 * sheets so the view model stays in one place.
 *
 * @license MIT
 */

import { CHIP_COLORS } from "../config.mjs";
import { toPascal } from "../utils.mjs";
import { applyChipCap, canSpend, executeSpend } from "./chip-rules.mjs";
import { FatePot } from "./fate-pot.mjs";

/**
 * Build the chip view-model array for HBS templates.
 * @param {{ white:number, red:number, blue:number, legend:number }} chips
 * @returns {Array<{ color:string, label:string, value:number, path:string }>}
 */
export function buildChipContext(chips) {
  return Object.keys(CHIP_COLORS).map((color) => ({
    color,
    label: `DEADLANDS.Chip.${toPascal(color)}.Label`,
    value: chips[color] ?? 0,
    path: `system.chips.${color}`,
  }));
}

/**
 * Grant chips to an actor (e.g., from a blind draw), respecting the 10-chip cap.
 * Surplus chips convert to Bounty Points. dlc p.147.
 *
 * @param {Actor} actor
 * @param {string[]} colors — chips to add (may include duplicates)
 * @returns {Promise<{ kept: string[], bpGained: number }>}
 */
export async function grantChips(actor, colors) {
  const { kept, bpGained } = applyChipCap(actor.system.chips, colors);

  const update = {};
  for (const color of kept) {
    const key = `system.chips.${color}`;
    update[key] = (update[key] ?? actor.system.chips[color] ?? 0) + 1;
  }
  if (bpGained > 0) {
    update["system.bounty"] = (actor.system.bounty ?? 0) + bpGained;
  }

  if (Object.keys(update).length) {
    await actor.update(update);
  }
  return { kept, bpGained };
}

/**
 * Spend one chip from an actor with full validation + pot accounting.
 * Convenience wrapper used by sheet action handlers.
 *
 * @param {Actor} actor
 * @param {string} color
 * @param {object} [opts]
 * @param {"normal"|"reroll"} [opts.mode]
 * @param {"trait"|"aptitude"|"damage"|"wound"|"wind"} [opts.rollType]
 * @param {boolean} [opts.isBust]
 * @param {boolean} [opts.higherAlreadySpent]
 * @returns {Promise<{ color:string, mode:string, marshalDraw:string|null }|null>}
 *   null if validation fails (ui.notifications.warn shown)
 */
export async function spendChip(actor, color, opts = {}) {
  const check = canSpend(color, {
    available: actor.system.chips[color] ?? 0,
    isBust: opts.isBust ?? false,
    higherAlreadySpent: opts.higherAlreadySpent ?? false,
  });

  if (!check.can) {
    ui.notifications.warn(game.i18n.localize(check.reason ?? "DEADLANDS.ChipRule.Unknown"));
    return null;
  }

  return executeSpend(actor, color, {
    mode: opts.mode ?? "normal",
    rollType: opts.rollType ?? "trait",
  });
}

// Re-export for convenience so callers can import from one place.
export { FatePot };
