/**
 * Hit-location draw helpers.
 *
 * Table verified against dlc p.133 (1d20 location, side via even/odd roll).
 * Raises on an attack allow the attacker to shift the result ±1 per raise —
 * that shift is passed as `offset` by the caller after confirming raises.
 *
 * Pure functions only — no Foundry runtime needed for unit tests.
 *
 * @license MIT
 */

import { HIT_LOCATION_TABLE } from "../config.mjs";

/**
 * Resolve a raw 1d20 roll (plus optional raise offset) to a location key,
 * and a side roll to disambiguate limbs (even = right, odd = left). dlc p.133.
 *
 * @param {number} d20          — 1–20 (physical die face)
 * @param {number} [sideD]      — any die face for left/right (1 = odd = left)
 * @param {number} [raiseOffset=0] — ±N from attacker's raises
 * @returns {string} — key matching HIT_LOCATIONS in config.mjs
 */
export function resolveHitLocation(d20, sideD = 1, raiseOffset = 0) {
  const clamped = Math.min(20, Math.max(1, d20 + raiseOffset));
  const entry = HIT_LOCATION_TABLE.find((e) => clamped >= e.min && clamped <= e.max);
  if (!entry) return "upperGuts"; // fallback — should never happen

  if (entry.location === "legs") {
    return sideD % 2 === 0 ? "rightLeg" : "leftLeg";
  }
  if (entry.location === "arms") {
    return sideD % 2 === 0 ? "rightArm" : "leftArm";
  }
  return entry.location;
}

/**
 * Draw a random hit location using injectable RNG. dlc p.133.
 *
 * @param {object} [opts]
 * @param {number} [opts.raiseOffset=0]  — ±N from attacker's raises
 * @param {() => number} [opts._rng]     — injectable for tests
 * @returns {string} — location key
 */
export function drawHitLocation({ raiseOffset = 0, _rng = Math.random } = {}) {
  const d20 = 1 + Math.floor(_rng() * 20);
  const sideD = 1 + Math.floor(_rng() * 6); // any die suffices
  return resolveHitLocation(d20, sideD, raiseOffset);
}
