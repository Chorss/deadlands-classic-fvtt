/**
 * Huckster hex-casting mechanics.
 *
 * castHex(actor, hexItem) — full workflow:
 *   roll hexslingin' → bust → backlash
 *   success → draw 5+raises cards → check jokers → evaluate hand → apply.
 *
 * Sources: dlc p.157-160, hnh p.33-34, hnh p.96-97, hnh p.101-102.
 *
 * @license MIT
 */

import { ActionDeck, buildFullDeck, shuffleDeck } from "../../core/cards/action-deck.mjs";
import { rollExplodingPool } from "../../core/dice/exploding-roll.mjs";
import { evaluateHand, meetsMinHand } from "../../core/dice/poker-hand-evaluator.mjs";
import { toPascal } from "../../core/utils.mjs";

/**
 * Extended Backlash Table — d20 roll per entry. `hnh` p.101-102.
 * Only mechanical data; no rulebook prose.
 *
 * `hexSucceeds` = true when the hex still fires despite the backlash (hnh p.101).
 *
 * @type {ReadonlyArray<{ roll: number, key: string, hexSucceeds: boolean }>}
 */
export const HUCKSTER_BACKLASH_TABLE = [
  { roll: 1, key: "mysticSputter", hexSucceeds: false }, // skill −1 for 1d6 days
  { roll: 2, key: "randomWound", hexSucceeds: false }, // 2d6 wounds to random location
  { roll: 3, key: "windLoss", hexSucceeds: false }, // −2d6 Wind
  { roll: 4, key: "scartCheck", hexSucceeds: false }, // 2d6 on Scart Table
  { roll: 5, key: "hexTurnsOnCaster", hexSucceeds: true }, // hex fires but hits caster
  { roll: 6, key: "hexSkillPenaltyTemp", hexSucceeds: false }, // hexslingin' −1 for 1d4 days
  { roll: 7, key: "companionWound", hexSucceeds: false }, // 2d6 to companion gut; Vigor Fair(5)
  { roll: 8, key: "companionWindLoss", hexSucceeds: false }, // −2d6 companion Wind; Vigor Fair(5)
  { roll: 9, key: "temporaryMadness", hexSucceeds: true }, // Dementia Table; Hard(9) Spirit/week
  { roll: 10, key: "hexHitsCompanions", hexSucceeds: true }, // hex fires but hits allies
  { roll: 11, key: "hexBlocked", hexSucceeds: false }, // no hexes for 1 day
  { roll: 12, key: "personalBacklash", hexSucceeds: false }, // 3d6 wounds to body
  { roll: 13, key: "limbBlocked", hexSucceeds: true }, // random limb unusable 1d12 hours
  { roll: 14, key: "scartCheckHeavy", hexSucceeds: false }, // 4d6 on Scart Table
  { roll: 15, key: "itemDestroyed", hexSucceeds: true }, // Manitoba destroys/steals possession
  { roll: 16, key: "brainDrain", hexSucceeds: false }, // hexslingin' −1 PERMANENT
  { roll: 17, key: "woundCurse", hexSucceeds: false }, // 2d6 wound + healing −2 levels harder
  { roll: 18, key: "heavyWindLoss", hexSucceeds: false }, // −3d6 Wind
  { roll: 19, key: "madness", hexSucceeds: false }, // Dementia Table (permanent)
  { roll: 20, key: "totalCorruption", hexSucceeds: false }, // opposed Spirit or 10 min possession
];

// ── Hex casting workflow ───────────────────────────────────────────────────────

/**
 * Full hex-casting workflow. dlc p.157, hnh p.33-34.
 *
 * @param {Actor} actor — Huckster actor
 * @param {Item} hexItem — the hex being cast
 * @param {{ tn?: number, modifier?: number, whiteSpend?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function castHex(actor, hexItem, opts = {}) {
  const tn = opts.tn ?? 5; // dlc p.157: Fair (5) is the default TN
  const modifier = opts.modifier ?? 0;
  const whiteSpend = opts.whiteSpend ?? 0;

  const { level: hexslinging = 0, modifier: hexMod = 0 } = actor.system.hexslingin ?? {};
  const hexTrait = hexItem.system.trait ?? "spirit";
  const traitData = actor.system.traits?.[hexTrait];
  const traitDieType = traitData?.dieType ?? "d6";
  const dieCount = Math.max(1, hexslinging + whiteSpend);

  // 1. Roll hexslingin'. dlc p.157: level dice of the hex's trait die type vs TN 5.
  const rollResult = rollExplodingPool(dieCount, traitDieType, { modifier: modifier + hexMod, tn });

  if (rollResult.bust) {
    // Bust → immediate backlash, no card draw. dlc p.157.
    await _sendCastMessage(actor, hexItem, rollResult, [], null, {
      bust: true,
      hexSucceeds: false,
      backlashTrigger: "bust",
    });
    await _resolveBacklash(actor, hexItem);
    await actor.update({ "system.backlashPending": false });
    return;
  }

  // 2. Draw 5 cards + 1 per raise. dlc p.157.
  const drawCount = 5 + rollResult.raises;
  const drawn = await _drawCards(drawCount);

  // 3. Joker rules. hnh p.33, hnh p.97.
  //    Black Joker → always backlash.
  //    Red Joker + hexslingin' level < 3 → backlash.
  //    Red Joker + hexslingin' level ≥ 3 → wild card, no backlash.
  const hasBlackJoker = drawn.some((c) => c.joker === "black");
  const hasRedJoker = drawn.some((c) => c.joker === "red");
  let backlashTrigger = null;
  if (hasBlackJoker) {
    backlashTrigger = "blackJoker";
  } else if (hasRedJoker && hexslinging < 3) {
    backlashTrigger = "redJoker";
  }

  // 4. Evaluate the best poker hand from the drawn cards (jokers are wild).
  const handResult = evaluateHand(drawn);
  const minHand = hexItem.system.hand ?? "pair";
  const handMeets = meetsMinHand(handResult, minHand);

  // Persist the draw for sheet display.
  await actor.update({
    "system.lastDraw": drawn,
    "system.backlashPending": backlashTrigger !== null,
  });

  if (!backlashTrigger) {
    // Clean result — no backlash.
    await _sendCastMessage(actor, hexItem, rollResult, drawn, handResult, {
      hexSucceeds: handMeets,
      minHand,
      backlashTrigger: null,
    });
    return;
  }

  // 5. Backlash path. Send cast result first, then resolve backlash.
  //    Whether the hex fires is determined by the backlash entry. hnh p.101-102.
  await _sendCastMessage(actor, hexItem, rollResult, drawn, handResult, {
    hexSucceeds: false, // final answer depends on the backlash entry
    minHand,
    backlashTrigger,
  });

  const entry = await _resolveBacklash(actor, hexItem);
  await actor.update({ "system.backlashPending": false });

  if (entry.hexSucceeds && handMeets) {
    await _sendHexSuccessFollowup(actor, hexItem);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Draw `count` cards from the active combat's Action Deck; fall back to a fresh deck. */
async function _drawCards(count) {
  if (game.combat) {
    return ActionDeck.deal(game.combat, count);
  }
  return shuffleDeck(buildFullDeck()).slice(0, count);
}

/**
 * Roll d20 on the Extended Backlash Table and whisper the result to the GM.
 * @returns {Promise<{ roll: number, key: string, hexSucceeds: boolean }>}
 */
async function _resolveBacklash(actor, hexItem) {
  const roll = Math.ceil(Math.random() * 20);
  const entry = HUCKSTER_BACKLASH_TABLE.find((e) => e.roll === roll) ?? HUCKSTER_BACKLASH_TABLE[0];

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/backlash-result.hbs",
    {
      actorName: actor.name,
      hexName: hexItem.name,
      roll,
      entryKey: `DEADLANDS.Huckster.Backlash.${toPascal(entry.key)}.Label`,
      noteKey: `DEADLANDS.Huckster.Backlash.${toPascal(entry.key)}.Note`,
      hexSucceeds: entry.hexSucceeds,
    }
  );

  await ChatMessage.create({
    content,
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: ChatMessage.getSpeaker({ actor }),
  });

  return entry;
}

/** Post the hex cast result to chat. */
async function _sendCastMessage(actor, hexItem, rollResult, drawn, handResult, meta) {
  const handKey = handResult ? `DEADLANDS.Huckster.Hand.${toPascal(handResult.handKey)}` : null;
  const minHandKey = meta.minHand ? `DEADLANDS.Huckster.Hand.${toPascal(meta.minHand)}` : null;

  const drawnWithLabels = drawn.map((c) => ({
    ...c,
    label: c.joker
      ? game.i18n.localize(`DEADLANDS.Combat.Card.${toPascal(c.joker)}Joker`)
      : `${c.rank} ${game.i18n.localize(`DEADLANDS.Combat.Card.Suit.${toPascal(c.suit)}`)}`,
  }));

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/hex-cast-result.hbs",
    {
      actorName: actor.name,
      hexName: hexItem.name,
      rollResult,
      drawn: drawnWithLabels,
      handResult,
      handKey,
      minHandKey,
      hexSucceeds: meta.hexSucceeds ?? false,
      backlashTrigger: meta.backlashTrigger ?? null,
      bust: meta.bust ?? false,
    }
  );

  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

/** Follow-up message when a backlash entry lets the hex fire anyway. */
async function _sendHexSuccessFollowup(actor, hexItem) {
  await ChatMessage.create({
    content: game.i18n.format("DEADLANDS.Huckster.Cast.SucceedsDespiteBacklash", {
      name: actor.name,
      hex: hexItem.name,
    }),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}
