/**
 * Damage roll for Deadlands Classic.
 *
 * Damage pools SUM all exploding dice (unlike trait rolls that take the
 * highest). Armor works two ways (`dlc` p.135-136): a positive Armor level
 * steps the damage die type DOWN the ladder (d4 < d6 < d8 < d10 < d12 < d20),
 * one rung per level, removing dice once it would drop below d4; "Light Armor"
 * (a negative Armor value) instead subtracts a flat amount from the total.
 * They layer: die-type reduction first, then the flat subtraction.
 *
 * @license MIT
 */

import { DAMAGE_DIE_LADDER } from "../config.mjs";
import { rollExplodingPool } from "./exploding-roll.mjs";

/**
 * @typedef {{
 *   dice: import("./exploding-roll.mjs").DieResult[],
 *   rawTotal: number,
 *   armorLevel: number,
 *   lightArmorValue: number,
 *   reducedDieCount: number,
 *   reducedDieType: string,
 *   total: number,
 *   aces: number,
 * }} DamageResult
 */

/**
 * Step a damage pool's die type/count down by `steps` levels of Armor. `dlc`
 * p.136. Ladder: d4 < d6 < d8 < d10 < d12 < d20. Once the die type would drop
 * below d4, remaining steps remove dice from the pool instead (e.g. 3d6 vs
 * Armor 2 → 2d4, matching the rulebook's worked example — never "below d4").
 *
 * @param {number} dieCount
 * @param {string} dieType
 * @param {number} steps — Armor level (0 = no reduction)
 * @returns {{ dieCount: number, dieType: string }}
 */
export function applyArmorDieReduction(dieCount, dieType, steps) {
  const idx = DAMAGE_DIE_LADDER.indexOf(dieType);
  if (idx === -1) {
    throw new RangeError(`Invalid damage die type: ${dieType}`);
  }
  if (steps <= 0) {
    return { dieCount, dieType };
  }
  const overflow = Math.max(0, steps - idx);
  const newIdx = Math.max(0, idx - steps);
  return { dieCount: Math.max(0, dieCount - overflow), dieType: DAMAGE_DIE_LADDER[newIdx] };
}

/**
 * Apply Light Armor's flat subtraction to a damage total, floored at 0. `dlc`
 * p.136.
 *
 * @param {number} total
 * @param {number} lightArmorValue — magnitude to subtract (non-negative)
 * @returns {number}
 */
export function applyLightArmorFlat(total, lightArmorValue) {
  return Math.max(0, total - lightArmorValue);
}

/**
 * Roll damage and post a chat message.
 *
 * @param {object} params
 * @param {number} params.dieCount
 * @param {string} params.dieType    — "d6" | "d8" etc.
 * @param {number} [params.modifier=0]
 * @param {number} [params.armorLevel=0] — Armor level: steps the die type/count down. dlc p.136.
 * @param {number} [params.lightArmorValue=0] — Light Armor: flat subtraction from the total. dlc p.136.
 * @param {string} [params.label]
 * @param {() => number} [params._rng]
 * @returns {Promise<DamageResult>}
 */
export async function rollDamage({
  dieCount,
  dieType,
  modifier = 0,
  armorLevel = 0,
  lightArmorValue = 0,
  label,
  _rng,
} = {}) {
  const reduced = applyArmorDieReduction(dieCount, dieType, armorLevel);

  // A pool reduced to 0 dice deals no dice damage — rollExplodingPool needs ≥1.
  const poolResult =
    reduced.dieCount > 0
      ? rollExplodingPool(reduced.dieCount, reduced.dieType, { modifier: 0, tn: 1, _rng })
      : { dice: [], aces: 0 };

  // Damage = SUM of all die totals + modifier (not highest). dlc damage rules.
  const preLightArmorTotal = poolResult.dice.reduce((sum, d) => sum + d.total, 0) + modifier;
  const total = applyLightArmorFlat(preLightArmorTotal, lightArmorValue);

  const result = {
    dice: poolResult.dice,
    rawTotal: preLightArmorTotal,
    armorLevel,
    lightArmorValue,
    reducedDieCount: reduced.dieCount,
    reducedDieType: reduced.dieType,
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
    result.lightArmorValue > 0
      ? ` <span class="dlc-armor">${game.i18n.format("DEADLANDS.Roll.ArmorReduction", {
          value: result.lightArmorValue,
        })}</span>`
      : "";

  const content = `<div class="dlc-chat-card dlc-night damage">
  <header class="dlc-roll-label">${game.i18n.localize("DEADLANDS.Roll.Damage")}: ${label}</header>
  <div class="dlc-roll-dice">${diceStr}</div>
  <div class="dlc-roll-total">${result.total}${armorStr}</div>
</div>`;

  await ChatMessage.create({ content, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
}
