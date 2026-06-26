/**
 * Trait/Aptitude roll — Foundry-integrated wrapper around rollExplodingPool.
 *
 * Sends a ChatMessage with the result. Exposed on `game.deadlandsClassic.dice`.
 * Accepts either an actor+traitId pair (sheet integration, Phase 4+) or a raw
 * parameter object (console testing, Phase 3).
 *
 * @license MIT
 */

import { rollExplodingPool } from "./exploding-roll.mjs";

/** Build the i18n key PascalCase segment from a camelCase id. */
function toPascal(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

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
  let dieCount, dieType, modifier, tn, label;

  if (actorOrParams && typeof actorOrParams === "object" && "dieCount" in actorOrParams) {
    // Signature A
    ({ dieCount, dieType, modifier = 0, tn = 5, label } = actorOrParams);
    label ??= `${dieCount}${dieType}`;
  } else {
    // Signature B
    const actor = actorOrParams;
    const trait = actor.system.traits[traitId];
    const aptId = options.aptitudeId;

    dieType = trait.dieType;
    if (aptId) {
      // Aptitude roll: aptitude level IS the die count. dlc p.27.
      // ("Aptitudes tell you how many Trait dice to roll.")
      dieCount = trait.aptitudes[aptId]?.level ?? 1;
    } else {
      // Pure trait roll: trait level is the die count. dlc p.27.
      dieCount = trait.dieCount ?? 1;
    }
    modifier = (options.modifier ?? 0) + (trait.modifier ?? 0);
    tn = options.tn ?? 5;

    const traitKey = `DEADLANDS.Trait.${toPascal(traitId)}.Label`;
    const traitLabel = game.i18n.localize(traitKey);
    const aptLabel = aptId ? ` / ${game.i18n.localize(`DEADLANDS.Aptitude.${toPascal(aptId)}.Label`)}` : "";
    label = `${traitLabel}${aptLabel} (${dieCount}${dieType})`;
  }

  const result = rollExplodingPool(dieCount, dieType, { modifier, tn });

  await _postChatMessage(result, label, tn);
  return result;
}

/**
 * @param {import("./exploding-roll.mjs").PoolResult} result
 * @param {string} label
 * @param {number} tn
 */
async function _postChatMessage(result, label, tn) {
  const diceStr = result.dice.map((d) => {
    const ace = d.aces > 0 ? `<span class="dlc-ace" title="Aces: ${d.aces}">⚡</span>` : "";
    return `<span class="dlc-die">${d.total}${ace}</span>`;
  }).join(" ");

  let outcomeClass, outcomeText;
  if (result.bust) {
    outcomeClass = "dlc-bust";
    outcomeText = game.i18n.localize("DEADLANDS.Roll.Bust");
  } else if (result.success) {
    outcomeClass = "dlc-success";
    outcomeText = result.raises > 0
      ? game.i18n.format("DEADLANDS.Roll.Raises", { raises: result.raises })
      : game.i18n.localize("DEADLANDS.Roll.Success");
  } else {
    outcomeClass = "dlc-fail";
    outcomeText = game.i18n.localize("DEADLANDS.Roll.Fail");
  }

  const modStr = result.modifier !== 0
    ? ` <span class="dlc-modifier">${result.modifier > 0 ? "+" : ""}${result.modifier}</span>` : "";

  const content = `<div class="dlc-roll-card ${outcomeClass}">
  <header class="dlc-roll-label">${label}</header>
  <div class="dlc-roll-dice">${diceStr}</div>
  <div class="dlc-roll-total">${result.highest}${modStr} <span class="dlc-tn">vs TN ${tn}</span></div>
  <div class="dlc-roll-outcome">${outcomeText}</div>
</div>`;

  await ChatMessage.create({ content, type: CONST.CHAT_MESSAGE_STYLES.OTHER });
}
