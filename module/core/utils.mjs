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
