/**
 * Trait/Aptitude roll — Foundry-integrated wrapper around rollExplodingPool.
 *
 * Sends a ChatMessage with the result. Exposed on `game.deadlandsClassic.dice`.
 * Accepts either an actor+traitId pair (sheet integration, Phase 4+) or a raw
 * parameter object (console testing, Phase 3).
 *
 * @license MIT
 */

import { toPascal } from "../utils.mjs";
import { rollExplodingPool } from "./exploding-roll.mjs";

/**
 * Roll a Trait (or Trait+Aptitude) pool and post a chat result.
 *
 * Signature A — raw params (console / testing):
 *   rollTrait({ dieCount, dieType, tn?, modifier?, label? })
 *
 * Signature B — actor context (sheet, Phase 4+):
 *   rollTrait(actor, traitId, { aptitudeId?, modifier?, tn? })
 *
 * @returns {Promise<import("./exploding-roll.mjs").PoolResult>}
 */
export async function rollTrait(actorOrParams, traitId, options = {}) {
  const params =
    actorOrParams && typeof actorOrParams === "object" && "dieCount" in actorOrParams
      ? _paramsFromRaw(actorOrParams)
      : _paramsFromActor(actorOrParams, traitId, options);

  const result = rollExplodingPool(params.dieCount, params.dieType, {
    modifier: params.modifier,
    tn: params.tn,
  });
  await _postChatMessage(result, params.label, params.tn, params.actor);
  return result;
}

/** Build roll params from a raw parameter object (Signature A — testing / console). */
function _paramsFromRaw({ dieCount, dieType, modifier = 0, tn = 5, label }) {
  return { dieCount, dieType, modifier, tn, label: label ?? `${dieCount}${dieType}` };
}

/** Build roll params from an actor + traitId (Signature B — sheet integration). */
function _paramsFromActor(actor, traitId, options) {
  const trait = actor.system.traits[traitId];
  const aptId = options.aptitudeId;
  const extraDice = options.extraDice ?? 0;
  const woundMod = actor.system.woundModifier ?? 0; // dlc p.140
  const baseMod = (options.modifier ?? 0) + (trait.modifier ?? 0) + woundMod;

  let dieCount, modifier, label;
  const dieType = trait.dieType;
  const tn = options.tn ?? 5;

  if (aptId) {
    const aptLevel = trait.aptitudes[aptId]?.level ?? 0;
    const unskilled = aptLevel === 0; // dlc p.29: no aptitude = 1 die, −4 modifier
    dieCount = (unskilled ? 1 : aptLevel) + extraDice;
    modifier = baseMod + (unskilled ? -4 : 0);
    const unskilledSuffix = unskilled ? ` [${game.i18n.localize("DEADLANDS.Roll.Unskilled")}]` : "";
    const aptLabel = game.i18n.localize(`DEADLANDS.Aptitude.${toPascal(aptId)}.Label`);
    label = `${game.i18n.localize(`DEADLANDS.Trait.${toPascal(traitId)}.Label`)} / ${aptLabel} (${dieCount}${dieType})${unskilledSuffix}`;
  } else {
    // Pure trait roll: trait die count. dlc p.27
    dieCount = (trait.dieCount ?? 1) + extraDice;
    modifier = baseMod;
    label = `${game.i18n.localize(`DEADLANDS.Trait.${toPascal(traitId)}.Label`)} (${dieCount}${dieType})`;
  }

  return { dieCount, dieType, modifier, tn, label, actor };
}

/**
 * @param {import("./exploding-roll.mjs").PoolResult} result
 * @param {string} label
 * @param {number} tn
 * @param {Actor} [actor]
 */
async function _postChatMessage(result, label, tn, actor) {
  const diceStr = result.dice
    .map((d) => {
      const ace = d.aces > 0 ? `<span class="dlc-ace" title="Aces: ${d.aces}">⚡</span>` : "";
      return `<span class="dlc-die">${d.total}${ace}</span>`;
    })
    .join(" ");

  let outcomeClass, outcomeText;
  if (result.bust) {
    outcomeClass = "dlc-bust";
    outcomeText = game.i18n.localize("DEADLANDS.Roll.Bust");
  } else if (result.success) {
    outcomeClass = "dlc-success";
    outcomeText =
      result.raises > 0
        ? game.i18n.format("DEADLANDS.Roll.Raises", { raises: result.raises })
        : game.i18n.localize("DEADLANDS.Roll.Success");
  } else {
    outcomeClass = "dlc-fail";
    outcomeText = game.i18n.localize("DEADLANDS.Roll.Fail");
  }

  const modStr =
    result.modifier !== 0
      ? ` <span class="dlc-modifier">${result.modifier > 0 ? "+" : ""}${result.modifier}</span>`
      : "";

  const content = `<div class="dlc-roll-card ${outcomeClass}">
  <header class="dlc-roll-label">${label}</header>
  <div class="dlc-roll-dice">${diceStr}</div>
  <div class="dlc-roll-total">${result.highest}${modStr} <span class="dlc-tn">vs TN ${tn}</span></div>
  <div class="dlc-roll-outcome">${outcomeText}</div>
</div>`;

  await ChatMessage.create({
    content,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    ...(actor ? { speaker: ChatMessage.getSpeaker({ actor }) } : {}),
  });
}
