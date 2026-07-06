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
import { applyChipCap, canSpend, executeSpend, executeWhiteSpend } from "./chip-rules.mjs";
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

  try {
    return await executeSpend(actor, color, {
      mode: opts.mode ?? "normal",
      rollType: opts.rollType ?? "trait",
    });
  } catch (err) {
    // The GM proxy has already shown a notification — log and abort.
    console.error("deadlands-classic | Chip spend aborted:", err);
    return null;
  }
}

/**
 * White-chip spend wrapper for roll flows: executes the spend, returning null
 * when the GM-routed pot write fails so the caller can abort its roll (the
 * proxy has already notified the user).
 *
 * @param {Actor} actor
 * @param {number} requested — raw whiteSpend value from the roll dialog
 * @returns {Promise<number|null>} chips actually spent, or null when the spend failed
 */
export async function tryWhiteSpend(actor, requested) {
  try {
    return await executeWhiteSpend(actor, requested);
  } catch (err) {
    console.error("deadlands-classic | White-chip spend aborted:", err);
    return null;
  }
}

/**
 * Spend white chips, then run a roll/cast action that consumes them — and if
 * that action throws (e.g. a GM-routed card deal times out), refund the chips
 * and notify, so a failed action never silently costs the player. Keeps the
 * rejection from escaping an un-awaited sheet-action handler.
 *
 * @param {Actor} actor
 * @param {number} requested — raw whiteSpend value from the roll dialog
 * @param {(whiteSpend: number) => Promise<any>} action — receives the amount actually spent
 * @returns {Promise<any|null>} the action's result, or null if the spend or action failed
 */
export async function runWithWhiteSpend(actor, requested, action) {
  const whiteSpend = await tryWhiteSpend(actor, requested);
  if (whiteSpend === null) {
    return null; // spend failed — the GM proxy already notified the user
  }

  try {
    return await action(whiteSpend);
  } catch (err) {
    console.error("deadlands-classic | Action failed after white-chip spend:", err);
    if (whiteSpend > 0) {
      await refundWhiteSpend(actor, whiteSpend).catch((refundErr) => {
        console.error("deadlands-classic | White-chip refund also failed:", refundErr);
      });
    }
    ui.notifications.error(game.i18n.localize("DEADLANDS.ChipRule.ActionFailedRefunded"));
    return null;
  }
}

/**
 * Reverse a white-chip spend: pull the returned chips back out of the pot and
 * credit them to the actor. The inverse of executeWhiteSpend's two writes.
 * @param {Actor} actor
 * @param {number} n
 */
async function refundWhiteSpend(actor, n) {
  await FatePot.discard("white", n);
  const current = actor.system.chips?.white ?? 0;
  await actor.update({ "system.chips.white": current + n });
}

// Re-export for convenience so callers can import from one place.
export { FatePot };
