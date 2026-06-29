/**
 * Wind (Stamina points) helpers.
 *
 * Wind max = Vigor die face + Spirit die face. dlc p.40.
 * Wind recovery: 1/minute natural; Medicine TN 3 resets to full. dlc p.144.
 *
 * @license MIT
 */

/**
 * Compute the maximum Wind from the two trait die types.
 * Wind max = Vigor die face + Spirit die face. dlc p.40.
 *
 * @param {{ vigor: { dieType: string }, spirit: { dieType: string } }} traits
 * @returns {number}
 */
export function computeWindMax(traits) {
  const vigorFace = Number((traits.vigor?.dieType ?? "d6").slice(1));
  const spiritFace = Number((traits.spirit?.dieType ?? "d6").slice(1));
  return vigorFace + spiritFace;
}

/**
 * Whether the actor is currently Winded (Wind ≤ 0). dlc p.141.
 * Winded characters receive no initiative cards and take no actions.
 *
 * @param {number} windValue
 * @returns {boolean}
 */
export function isWinded(windValue) {
  return windValue <= 0;
}

/**
 * Negative Wind penalty: every interval of −startWind causes +1 wound to guts.
 * dlc p.141-142.
 *
 * Returns how many guts wounds the actor should receive for their current Wind
 * given their starting Wind max.
 *
 * @param {number} windValue  — current (may be negative)
 * @param {number} windMax    — maximum Wind (starting Wind)
 * @returns {number} — guts wounds owed (0 if not yet negative enough)
 */
export function gutsWoundsFromNegativeWind(windValue, windMax) {
  if (windValue >= 0 || windMax <= 0) {
    return 0;
  }
  return Math.floor(Math.abs(windValue) / windMax);
}
