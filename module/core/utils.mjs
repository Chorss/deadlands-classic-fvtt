/**
 * Shared utility helpers — pure functions, no Foundry dependency.
 * @license MIT
 */

/**
 * Convert a camelCase identifier to a PascalCase i18n segment.
 * "sleightOfHand" → "SleightOfHand", "deftness" → "Deftness".
 * @param {string} id
 * @returns {string}
 */
export function toPascal(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Numeric face value of a die-type string ("d8" → 8). Used wherever a Trait
 * die's face value (not its die count) drives a derived number — Wind max,
 * Pace, Harrowed Dominion pool size.
 * @param {string} dieType
 * @returns {number}
 */
export function dieFace(dieType) {
  const n = Number.parseInt(String(dieType).replace(/^d/, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
