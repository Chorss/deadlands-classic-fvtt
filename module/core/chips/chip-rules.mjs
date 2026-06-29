/**
 * Chip-spend validation and execution.
 *
 * Rules verified against dlc p.146-148:
 *   - White: unlimited per action; +1 die per chip. dlc p.147.
 *   - Red/Blue/Legend: max 1 per action. dlc p.147-148.
 *   - Bust: only Legend (reroll mode) may be spent. dlc p.148.
 *   - Spent chips return to pot. Exception: Legend Reroll → permanent discard. dlc p.26, p.148.
 *   - Red on trait/aptitude → Marshal's Tithe. dlc p.148.
 *   - Actor cap = 10 chips; surplus converts to BP. dlc p.147.
 *
 * `canSpend` is pure (no Foundry I/O) for unit tests (chip-rules.test.mjs, Phase 5).
 *
 * @license MIT
 */

import { CHIP_COLORS, CHIP_LIMIT } from "../config.mjs";
import { FatePot } from "./fate-pot.mjs";

// ── Validation (pure) ─────────────────────────────────────────────────────────

/**
 * @typedef {{ can: boolean, reason?: string }} SpendCheck
 */

/**
 * Check whether a chip can be spent in the current roll context.
 *
 * @param {string} color — "white" | "red" | "blue" | "legend"
 * @param {object} context
 * @param {number}  context.available   — how many chips of this color the actor has
 * @param {boolean} [context.isBust]    — true if the roll went bust
 * @param {boolean} [context.higherAlreadySpent] — true if red/blue/legend already spent this action
 * @returns {SpendCheck}
 */
export function canSpend(
  color,
  { available = 0, isBust = false, higherAlreadySpent = false } = {}
) {
  if (!CHIP_COLORS[color]) return { can: false, reason: "DEADLANDS.ChipRule.Unknown" };
  if (available <= 0) return { can: false, reason: "DEADLANDS.ChipRule.NoneLeft" };

  // During bust only Legend (reroll) is valid. dlc p.148.
  if (isBust && color !== "legend") {
    return { can: false, reason: "DEADLANDS.ChipRule.BustOnlyLegend" };
  }

  // Red / Blue / Legend: max 1 per action. dlc p.147-148.
  if (color !== "white" && higherAlreadySpent) {
    return { can: false, reason: "DEADLANDS.ChipRule.OnePerAction" };
  }

  return { can: true };
}

/**
 * Compute how many chips an actor can hold from a proposed grant, and how many
 * convert to Bounty Points. dlc p.147.
 *
 * @param {{ white:number, red:number, blue:number, legend:number }} currentChips
 * @param {string[]} incoming — array of color strings to add
 * @returns {{ kept: string[], bpGained: number }}
 */
export function applyChipCap(currentChips, incoming) {
  const total = Object.values(currentChips).reduce((s, n) => s + n, 0);
  const BP_VALUE = { white: 1, red: 2, blue: 3, legend: 5 };

  let held = total;
  let bpGained = 0;
  const kept = [];

  for (const color of incoming) {
    if (held < CHIP_LIMIT) {
      kept.push(color);
      held++;
    } else {
      bpGained += BP_VALUE[color] ?? 1;
    }
  }
  return { kept, bpGained };
}

// ── Execution (Foundry-integrated) ────────────────────────────────────────────

/**
 * Execute a chip spend: deduct from actor, handle pot return / discard,
 * trigger Marshal's Tithe for red chips. dlc p.26, p.147-148.
 *
 * @param {Actor} actor
 * @param {string} color
 * @param {object} [opts]
 * @param {"normal"|"reroll"} [opts.mode="normal"] — Legend chips only; "reroll" = permanent discard
 * @param {"trait"|"damage"|"wound"|"wind"} [opts.rollType="trait"] — for Tithe check
 * @returns {Promise<{ color: string, mode: string, marshalDraw: string|null }>}
 */
export async function executeSpend(actor, color, { mode = "normal", rollType = "trait" } = {}) {
  const current = actor.system.chips[color] ?? 0;
  if (current <= 0) throw new Error(`Actor has no ${color} chips to spend.`);

  // Deduct from actor.
  await actor.update({ [`system.chips.${color}`]: current - 1 });

  // Pot accounting.
  let marshalDraw = null;
  if (color === "legend" && mode === "reroll") {
    // Permanent discard — "gone forever". dlc p.148.
    await FatePot.discard("legend", 1);
  } else {
    // All other spends return to pot. dlc p.26.
    await FatePot.returnToPool(color, 1);

    // Marshal's Tithe: only red, only on trait/aptitude rolls. dlc p.148.
    if (color === "red" && (rollType === "trait" || rollType === "aptitude")) {
      marshalDraw = await FatePot.marshalTithe();
    }
  }

  return { color, mode, marshalDraw };
}
