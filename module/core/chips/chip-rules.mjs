/**
 * Chip-spend validation and execution.
 *
 * Rules verified against dlc p.146-148:
 *   - White: unlimited per action; +1 die per chip. dlc p.147.
 *   - No Going Back: no more white chips once a red/blue/legend is spent. dlc p.148.
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
 * @param {boolean} [context.higherAlreadySpent] — true if red/blue/legend already spent this
 *   action. Gates both directions: a second red/blue/legend (max 1/action) and any further white
 *   chip (No Going Back). dlc p.147-148.
 * @returns {SpendCheck}
 */
export function canSpend(
  color,
  { available = 0, isBust = false, higherAlreadySpent = false } = {}
) {
  if (!CHIP_COLORS[color]) {
    return { can: false, reason: "DEADLANDS.ChipRule.Unknown" };
  }
  if (available <= 0) {
    return { can: false, reason: "DEADLANDS.ChipRule.NoneLeft" };
  }

  // During bust only Legend (reroll) is valid. dlc p.148.
  if (isBust && color !== "legend") {
    return { can: false, reason: "DEADLANDS.ChipRule.BustOnlyLegend" };
  }

  // Red / Blue / Legend: max 1 per action. dlc p.147-148.
  if (color !== "white" && higherAlreadySpent) {
    return { can: false, reason: "DEADLANDS.ChipRule.OnePerAction" };
  }

  // No Going Back: once a red/blue/legend chip is spent this action, no more
  // white chips may be spent on it. dlc p.148.
  if (color === "white" && higherAlreadySpent) {
    return { can: false, reason: "DEADLANDS.ChipRule.NoGoingBack" };
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
  const initial = actor.system.chips[color] ?? 0;
  if (initial <= 0) {
    throw new Error(`Actor has no ${color} chips to spend.`);
  }

  // Pot accounting first — it routes through the GM proxy and is the step
  // that can fail (e.g. no GM online). The chip leaves the actor only after
  // the pot write succeeds, so a rejected pot op can't vanish the chip.
  let marshalDraw = null;
  if (color === "legend" && mode === "reroll") {
    // Permanent discard — "gone forever". dlc p.148.
    await FatePot.discard("legend", 1);
  } else {
    // Return the chip to the pot and, for red on a trait/aptitude roll, draw
    // the Marshal's Tithe — atomically, in one GM write, so a mid-op failure
    // can't inflate the pot without the matching draw. dlc p.26, p.148.
    const tithe = color === "red" && (rollType === "trait" || rollType === "aptitude");
    marshalDraw = await FatePot.spendWithTithe(color, { tithe });
  }

  // Re-read the live count: the GM round trip above can change the actor's
  // chips mid-flight (e.g. the Marshal grants one, or a Joker draw resolves).
  // Writing `initial - 1` from the pre-await snapshot would silently clobber
  // that change, so base the deduction on the current value instead.
  const current = actor.system.chips[color] ?? 0;
  await actor.update({ [`system.chips.${color}`]: Math.max(0, current - 1) });

  return { color, mode, marshalDraw };
}

/**
 * Spend N white chips at once (extra dice on a roll). dlc p.26, p.147.
 * White chips are unlimited per action, but every spent chip still returns
 * to the pot like any other color — no Marshal's Tithe, no bust/one-per-
 * action gating (those apply to red/blue/legend only).
 *
 * Reads the actor's live chip count here, at spend time, rather than trusting
 * a count captured before an awaited dialog — a stale pre-dialog count would
 * silently clobber any chip change made while the dialog was open.
 *
 * @param {Actor} actor
 * @param {number} requested — raw whiteSpend value from the roll dialog
 * @returns {Promise<number>} the clamped amount actually spent
 */
export async function executeWhiteSpend(actor, requested) {
  const available = actor.system.chips?.white ?? 0;
  const spend = Math.min(Math.max(0, requested), available);
  if (spend > 0) {
    // Pot write first (GM-routed, can fail) — see executeSpend.
    await FatePot.returnToPool("white", spend);
    // Re-read after the GM round trip so a concurrent grant isn't clobbered;
    // the deduction is a delta off the current value, not the pre-await one.
    const current = actor.system.chips?.white ?? 0;
    await actor.update({ "system.chips.white": Math.max(0, current - spend) });
  }
  return spend;
}
