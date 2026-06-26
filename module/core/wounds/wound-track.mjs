/**
 * Wound-track helpers — pure accumulation logic + Foundry-integrated application.
 *
 * Mechanics verified against dlc p.138-142:
 *   - Wounds per hit = floor(damage / size). dlc p.138.
 *   - Wounds accumulate (ADD) per location; cap 5 (Maimed). dlc p.139.
 *   - Wind per hit = woundAmount × 1d6 open-ended; minimum 1d6 even with 0 wounds. dlc p.141.
 *   - Wind ≤ 0 → Winded (no initiative cards, no actions). dlc p.141.
 *   - Bleeding per round: Serious −1 Wind, Critical −2 Wind, Maimed limb −3 Wind. dlc p.142.
 *   - Wind recovery: 1/minute naturally; Medicine TN 3 resets to full (~5 min). dlc p.144.
 *
 * `woundsFromDamage`, `getBleedingRateForLocation` are pure for unit tests.
 * `applyWounds`, `tickBleeding`, `recoverWind` require a live Foundry actor.
 *
 * @license MIT
 */

import { WOUND_MAX, WOUND_PENALTIES } from "../config.mjs";
import { rollExplodingPool } from "../dice/exploding-roll.mjs";

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Compute how many wounds a hit inflicts. dlc p.138.
 *
 * @param {number} damageTotal — net damage after armor reduction
 * @param {number} [size=6]   — target's Size attribute (default 6)
 * @returns {number} — wound count (may be 0)
 */
export function woundsFromDamage(damageTotal, size = 6) {
  if (damageTotal <= 0 || size <= 0) return 0;
  return Math.floor(damageTotal / size);
}

/**
 * Compute new severity for a location after adding wounds.
 *
 * @param {number} current — current severity (0–5)
 * @param {number} adding  — wounds to add
 * @returns {number} — new severity, capped at WOUND_MAX (5)
 */
export function accumulateWounds(current, adding) {
  return Math.min(WOUND_MAX, current + adding);
}

/**
 * Wind lost per hit = woundAmount × 1d6 open-ended; minimum 1d6. dlc p.141.
 *
 * Pure: returns the die count so the caller can roll them.
 * @param {number} woundAmount
 * @returns {number} die count for the wind roll (≥ 1)
 */
export function windDiceCount(woundAmount) {
  return Math.max(1, woundAmount);
}

/**
 * Bleeding Wind drain per round for a given severity. dlc p.142.
 *
 * @param {number} severity — wound level for a single location
 * @param {boolean} [isLimb=false] — true for arm/leg locations (maimed limb +3/round)
 * @returns {number} — Wind points lost this round (0 if no bleed)
 */
export function getBleedingRate(severity, isLimb = false) {
  if (severity >= 5 && isLimb) return 3; // Maimed limb
  if (severity >= 4) return 2; // Critical
  if (severity >= 3) return 1; // Serious
  return 0;
}

/**
 * The highest wound penalty across all locations. dlc p.140.
 * Used by prepareDerivedData as `woundModifier`.
 *
 * @param {Record<string, { severity: number }>} woundLocations
 * @returns {number} — penalty (0 or negative)
 */
export function highestWoundPenalty(woundLocations) {
  const maxSeverity = Object.values(woundLocations).reduce(
    (max, loc) => Math.max(max, loc.severity ?? 0),
    0
  );
  return WOUND_PENALTIES[maxSeverity] ?? 0;
}

// ── Foundry-integrated ────────────────────────────────────────────────────────

/**
 * Apply wounds to a location and roll Wind damage, then update the actor.
 *
 * @param {Actor} actor
 * @param {string} location — HIT_LOCATIONS key (e.g. "upperGuts", "leftArm")
 * @param {number} damageTotal — net damage after armor
 * @param {object} [opts]
 * @param {() => number} [opts._rng]
 * @returns {Promise<{ woundAmount: number, newSeverity: number, windLost: number }>}
 */
export async function applyWounds(actor, location, damageTotal, { _rng = Math.random } = {}) {
  const size = actor.system.size ?? 6;
  const woundAmount = woundsFromDamage(damageTotal, size);

  const current = actor.system.wounds?.[location]?.severity ?? 0;
  const newSeverity = accumulateWounds(current, woundAmount);

  // Wind roll: woundAmount × 1d6 open-ended (sum), min 1d6. dlc p.141.
  const dieCount = windDiceCount(woundAmount);
  const windPool = rollExplodingPool(dieCount, "d6", { modifier: 0, tn: 1, _rng });
  const windLost = windPool.dice.reduce((sum, d) => sum + d.total, 0);

  const currentWind = actor.system.wind?.value ?? actor.system.wind?.max ?? 0;
  const newWind = currentWind - windLost;

  await actor.update({
    [`system.wounds.${location}.severity`]: newSeverity,
    "system.wind.value": newWind,
  });

  return { woundAmount, newSeverity, windLost };
}

/**
 * Apply per-round bleeding drain for all wounded locations. dlc p.142.
 * Call once per combat round (e.g. from combat turn hook).
 *
 * @param {Actor} actor
 * @returns {Promise<number>} total Wind lost this tick
 */
export async function tickBleeding(actor) {
  const locations = actor.system.wounds ?? {};
  let totalDrain = 0;

  for (const [locId, locData] of Object.entries(locations)) {
    const isLimb = locId.endsWith("Arm") || locId.endsWith("Leg");
    totalDrain += getBleedingRate(locData.severity ?? 0, isLimb);
  }

  if (totalDrain > 0) {
    const current = actor.system.wind?.value ?? 0;
    await actor.update({ "system.wind.value": current - totalDrain });
  }

  return totalDrain;
}

/**
 * Natural Wind recovery: +1/minute. dlc p.144.
 * Called from a time-advancement hook or manually by the GM.
 *
 * @param {Actor} actor
 * @param {number} [minutes=1]
 * @returns {Promise<number>} new wind.value
 */
export async function recoverWind(actor, minutes = 1) {
  const current = actor.system.wind?.value ?? 0;
  const max = actor.system.wind?.max ?? current;
  const recovered = Math.min(max, current + minutes);
  await actor.update({ "system.wind.value": recovered });
  return recovered;
}
