/**
 * Damage roll for Deadlands Classic.
 *
 * Damage pools SUM all exploding dice (unlike trait rolls that take the
 * highest). Armor reduces the total — the exact reduction mechanic (die-type
 * downgrade per dlc p.134) is implemented in Phase 6; Phase 3 accepts a flat
 * `armorValue` integer as a placeholder.
 *
 * @license MIT
 */

import { rollExplodingPool } from "./exploding-roll.mjs";

/**
 * @typedef {{
 *   dice: import("./exploding-roll.mjs").DieResult[],
 *   rawTotal: number,
 *   armorValue: number,
 *   total: number,
 *   aces: number,
 * }} DamageResult
 */

/**
 * Roll damage and post a chat message.
 *
 * @param {object} params
 * @param {number} params.dieCount
 * @param {string} params.dieType    — "d6" | "d8" etc.
 * @param {number} [params.modifier=0]
 * @param {number} [params.armorValue=0] — flat damage reduction (placeholder for die-type reduction, dlc p.134)
 * @param {string} [params.label]
 * @param {() => number} [params._rng]
 * @returns {Promise<DamageResult>}
 */
export async function rollDamage({
  dieCount,
  dieType,
  modifier = 0,
  armorValue = 0,
  label,
  _rng,
} = {}) {
  // Pass modifier=0 to the pool — we apply it to the sum ourselves below.
  const poolResult = rollExplodingPool(dieCount, dieType, { modifier: 0, tn: 1, _rng });

  // Damage = SUM of all die totals + modifier (not highest). dlc damage rules.
  const rawTotal = poolResult.dice.reduce((sum, d) => sum + d.total, 0) + modifier;
  const total = Math.max(0, rawTotal - armorValue);

  const result = {
    dice: poolResult.dice,
    rawTotal,
    armorValue,
    total,
    aces: poolResult.aces,
  };

  await _postDamageChatMessage(result, label ?? `${dieCount}${dieType}`);
  return result;
}

/**
 * @param {DamageResult} result
 * @param {string} label
 */
async function _postDamageChatMessage(result, label) {
  const diceStr = result.dice
    .map((d) => {
      const ace = d.aces > 0 ? `<span class="dlc-ace">⚡</span>` : "";
      return `<span class="dlc-die">${d.total}${ace}</span>`;
    })
    .join(" ");

  const armorStr =
    result.armorValue > 0 ? ` <span class="dlc-armor">− ${result.armorValue} armor</span>` : "";

  const content = `<div class="dlc-roll-card dlc-damage">
  <header class="dlc-roll-label">${game.i18n.localize("DEADLANDS.Roll.Damage")}: ${label}</header>
  <div class="dlc-roll-dice">${diceStr}</div>
  <div class="dlc-roll-total">${result.total}${armorStr}</div>
</div>`;

  await ChatMessage.create({ content, type: CONST.CHAT_MESSAGE_STYLES.OTHER });
}
