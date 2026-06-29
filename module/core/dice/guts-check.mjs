/**
 * Guts/fear check — Spirit/Guts roll followed by the Scart Table on failure.
 *
 * Mechanics verified against dlc p.220-222:
 *   - Guts aptitude under Spirit; dieCount = Guts level; unskilled = 1 die, −4. dlc p.44, p.29.
 *   - TN and Scart dice by terror level (3/5/7/9/11/13 → 1d6–6d6). dlc p.221.
 *   - Fear Level imposes −fearLevel penalty to the roll. dlc p.220.
 *   - Grit adds +1 per point (max 5). dlc p.223.
 *   - On fail: roll scartDice×d6 (open-ended/Aces), look up SCART_TABLE. dlc p.222.
 *   - Success: no effect. dlc p.221.
 *
 * `scartDiceForTN` and `lookupScart` are pure — unit-testable without Foundry.
 * `rollGutsCheck` is Foundry-integrated and posts one unified ChatMessage.
 *
 * @license MIT
 */

import { GUTS_TN_TABLE, SCART_TABLE } from "../config.mjs";
import { toPascal } from "../utils.mjs";
import { rollExplodingPool } from "./exploding-roll.mjs";

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Number of d6s to roll on the Scart Table for a given Guts check TN. dlc p.221.
 *
 * @param {number} tn
 * @returns {number} — die count (1–6)
 */
export function scartDiceForTN(tn) {
  const row = GUTS_TN_TABLE.slice()
    .reverse()
    .find((r) => tn >= r.tn);
  return row?.scartDice ?? 1;
}

/**
 * Look up a Scart Table entry by total roll. dlc p.222.
 *
 * @param {number} total — sum of scart dice (open-ended d6s)
 * @returns {{ key: string, windDice: number } | null}
 */
export function lookupScart(total) {
  return SCART_TABLE.find((r) => total >= r.min && total <= r.max) ?? null;
}

// ── Foundry-integrated ────────────────────────────────────────────────────────

/**
 * Roll a Guts check for an actor and post one unified chat card.
 *
 * Uses rollExplodingPool directly (not rollTrait) so a single ChatMessage
 * combines the Guts roll and the Scart Table result.
 *
 * @param {Actor} actor
 * @param {object} opts
 * @param {number} opts.tn            — Guts check TN (3/5/7/9/11/13). dlc p.221.
 * @param {number} [opts.fearLevel=0] — world Fear Level 0–6 (penalty). dlc p.220.
 * @param {number} [opts.modifier=0]  — additional situational modifier
 * @param {() => number} [opts._rng]
 * @returns {Promise<{
 *   gutsResult: import("./exploding-roll.mjs").PoolResult,
 *   success: boolean,
 *   scartEntry: { key: string, windDice: number } | null,
 *   scartRoll: number,
 *   windLost: number,
 * }>}
 */
export async function rollGutsCheck(
  actor,
  { tn = 5, fearLevel = 0, modifier = 0, _rng = Math.random } = {}
) {
  const spirit = actor.system.traits.spirit;
  const gutsDieCount = spirit.aptitudes.guts?.level ?? 0;
  const unskilled = gutsDieCount === 0;
  const dieCount = unskilled ? 1 : gutsDieCount;

  const grit = actor.system.grit ?? 0;
  const woundMod = actor.system.woundModifier ?? 0; // dlc p.140
  const unskilledPenalty = unskilled ? -4 : 0; // dlc p.29
  const totalModifier = modifier - fearLevel + grit + woundMod + unskilledPenalty;

  const gutsResult = rollExplodingPool(dieCount, spirit.dieType, {
    modifier: totalModifier,
    tn,
    _rng,
  });

  if (gutsResult.success) {
    await _postGutsChat({
      actor,
      gutsResult,
      tn,
      success: true,
      unskilled,
      scartEntry: null,
      scartRoll: 0,
      windLost: 0,
    });
    return { gutsResult, success: true, scartEntry: null, scartRoll: 0, windLost: 0 };
  }

  // Failed — roll Scart Table. dlc p.221-222.
  const numScartDice = scartDiceForTN(tn);
  const scartPool = rollExplodingPool(numScartDice, "d6", { modifier: 0, tn: 1, _rng });
  const scartRoll = scartPool.dice.reduce((sum, d) => sum + d.total, 0);
  const scartEntry = lookupScart(scartRoll);

  // Roll and apply Wind damage from the Scart result. dlc p.222.
  let windLost = 0;
  if (scartEntry?.windDice > 0) {
    const windPool = rollExplodingPool(scartEntry.windDice, "d6", { modifier: 0, tn: 1, _rng });
    windLost = windPool.dice.reduce((sum, d) => sum + d.total, 0);
    const currentWind = actor.system.wind?.value ?? 0;
    await actor.update({ "system.wind.value": currentWind - windLost });
  }

  await _postGutsChat({
    actor,
    gutsResult,
    tn,
    success: false,
    unskilled,
    scartEntry,
    scartRoll,
    windLost,
  });
  return { gutsResult, success: false, scartEntry, scartRoll, windLost };
}

/**
 * @param {object} p
 * @param {Actor} p.actor
 * @param {import("./exploding-roll.mjs").PoolResult} p.gutsResult
 * @param {number} p.tn
 * @param {boolean} p.success
 * @param {boolean} p.unskilled
 * @param {{ key: string, windDice: number } | null} p.scartEntry
 * @param {number} p.scartRoll
 * @param {number} p.windLost
 */
async function _postGutsChat({
  actor,
  gutsResult,
  tn,
  success,
  unskilled,
  scartEntry,
  scartRoll,
  windLost,
}) {
  const outcomeClass = success ? "dlc-success" : "dlc-bust";
  const outcomeText = success
    ? game.i18n.localize("DEADLANDS.Guts.Success")
    : game.i18n.localize("DEADLANDS.Guts.Fail");

  const unskilledStr = unskilled
    ? ` <span class="dlc-unskilled">[${game.i18n.localize("DEADLANDS.Roll.Unskilled")}]</span>`
    : "";

  const modStr =
    gutsResult.modifier !== 0
      ? ` <span class="dlc-modifier">${gutsResult.modifier > 0 ? "+" : ""}${gutsResult.modifier}</span>`
      : "";

  let scartHtml = "";
  if (scartEntry) {
    const effectLabel = game.i18n.localize(`DEADLANDS.Scart.${toPascal(scartEntry.key)}.Label`);
    const gmNote = game.i18n.localize(`DEADLANDS.Scart.${toPascal(scartEntry.key)}.Note`);
    const windStr =
      windLost > 0
        ? ` <span class="dlc-wind-lost">(−${windLost} ${game.i18n.localize("DEADLANDS.Sheet.Wind")})</span>`
        : "";
    scartHtml = `
  <div class="dlc-scart-result">
    <span class="dlc-scart-roll">${game.i18n.localize("DEADLANDS.Guts.ScartRoll")}: ${scartRoll}</span>
    <strong class="dlc-scart-effect">${effectLabel}${windStr}</strong>
    <p class="dlc-scart-note dlc-gm-note">${gmNote}</p>
  </div>`;
  }

  const content = `<div class="dlc-roll-card ${outcomeClass}">
  <header class="dlc-roll-label">${game.i18n.localize("DEADLANDS.Guts.Label")}: ${actor.name}${unskilledStr}</header>
  <div class="dlc-roll-total">${gutsResult.highest}${modStr} <span class="dlc-tn">vs TN ${tn}</span></div>
  <div class="dlc-roll-outcome">${outcomeText}</div>${scartHtml}
</div>`;

  await ChatMessage.create({ content, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
}
