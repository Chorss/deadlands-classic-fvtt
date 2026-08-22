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
import { STUN_RECOVERY_TNS } from "../../core/config.mjs";
import { rollExplodingPool } from "../../core/dice/exploding-roll.mjs";
import { lookupScart } from "../../core/dice/guts-check.mjs";
import { evaluateHand, meetsMinHand } from "../../core/dice/poker-hand-evaluator.mjs";
import { toPascal } from "../../core/utils.mjs";
import { woundsFromDamage } from "../../core/wounds/wound-track.mjs";

/**
 * Extended Backlash Table — d20 roll per entry. `hnh` p.101-102.
 * Only mechanical data; no rulebook prose.
 *
 * `hexSucceeds` = true when the hex still fires despite the backlash. Most
 * rows are fixed either way, but per hnh p.97 "about half the time... a
 * huckster who gets hit with backlash still has some chance of successfully
 * casting his hex" — 7 rows are conditional, not fixed, and carry a `gate`:
 *   - `"stun"` (rows 2, 7, 12, 17): the row's stated damage triggers a real
 *     Stun check (Vigor vs the wound's level, dlc p.140-141); the hex fails
 *     only if that check busts (huckster loses consciousness).
 *   - `"scart"` (row 4): fails only if the Scart roll comes back "Willies"
 *     or worse (hnh p.101).
 *   - `"marshal"` (rows 3, 8): the row is pure Wind loss with no wound, and
 *     dlc p.141 leaves "loses consciousness" from Wind alone to the
 *     Marshal's judgment ("It really depends on the situation") — there's
 *     no dice formula to automate, so this defaults to failing the hex and
 *     the chat card flags it as the Marshal's call.
 * `guaranteedMinimum` (rows 5, 10) means the hex "has at least the minimum
 * success" regardless of the drawn poker hand (hnh p.101) — `castHex` must
 * not gate their follow-up on `handMeets`.
 * Resolved at runtime by `_resolveGate`; see there for the dice.
 *
 * @type {ReadonlyArray<{ roll: number, key: string, hexSucceeds: boolean, gate?: string, guaranteedMinimum?: boolean, damageDice?: number, windDice?: number, scartDice?: number }>}
 */
export const HUCKSTER_BACKLASH_TABLE = [
  { roll: 1, key: "mysticSputter", hexSucceeds: false }, // skill −1 for 1d6 days
  { roll: 2, key: "randomWound", hexSucceeds: false, gate: "stun", damageDice: 2 }, // 2d6 damage to random location
  { roll: 3, key: "windLoss", hexSucceeds: false, gate: "marshal", windDice: 2 }, // −2d6 Wind
  { roll: 4, key: "scartCheck", hexSucceeds: false, gate: "scart", scartDice: 2 }, // 2d6 on Scart Table
  { roll: 5, key: "hexTurnsOnCaster", hexSucceeds: true, guaranteedMinimum: true }, // hex fires but hits caster
  { roll: 6, key: "hexSkillPenaltyTemp", hexSucceeds: false }, // hexslingin' −1 for 1d4 days
  { roll: 7, key: "companionWound", hexSucceeds: false, gate: "stun", damageDice: 2 }, // 2d6 to companion gut; Vigor Fair(5)
  { roll: 8, key: "companionWindLoss", hexSucceeds: false, gate: "marshal", windDice: 2 }, // −2d6 companion Wind; Vigor Fair(5)
  { roll: 9, key: "temporaryMadness", hexSucceeds: true }, // Dementia Table; Hard(9) Spirit/week
  { roll: 10, key: "hexHitsCompanions", hexSucceeds: true, guaranteedMinimum: true }, // hex fires but hits allies
  { roll: 11, key: "hexBlocked", hexSucceeds: false }, // no hexes for 1 day
  { roll: 12, key: "personalBacklash", hexSucceeds: false, gate: "stun", damageDice: 3 }, // 3d6 wounds to body
  { roll: 13, key: "limbBlocked", hexSucceeds: true }, // random limb unusable 1d12 hours
  { roll: 14, key: "scartCheckHeavy", hexSucceeds: false }, // 4d6 on Scart Table
  { roll: 15, key: "itemDestroyed", hexSucceeds: true }, // Manitoba destroys/steals possession
  { roll: 16, key: "brainDrain", hexSucceeds: false }, // hexslingin' −1 PERMANENT
  { roll: 17, key: "woundCurse", hexSucceeds: false, gate: "stun", damageDice: 2 }, // 2d6 wound + healing −2 levels harder
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

  // Rows 5/10 guarantee "at least the minimum success" regardless of the
  // drawn hand (hnh p.101) — every other succeeding row still needs the
  // hand to meet the item's minimum.
  if (entry.hexSucceeds && (entry.guaranteedMinimum || handMeets)) {
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
 * Roll d20 on the Extended Backlash Table, resolve any conditional gate, and
 * whisper the result to the GM.
 * @returns {Promise<{ roll: number, key: string, hexSucceeds: boolean, guaranteedMinimum?: boolean }>}
 */
async function _resolveBacklash(actor, hexItem) {
  const roll = Math.ceil(Math.random() * 20);
  const baseEntry =
    HUCKSTER_BACKLASH_TABLE.find((e) => e.roll === roll) ?? HUCKSTER_BACKLASH_TABLE[0];
  const gateResult = _resolveGate(actor, baseEntry);
  const entry = { ...baseEntry, ...gateResult };

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/backlash-result.hbs",
    {
      actorName: actor.name,
      hexName: hexItem.name,
      roll,
      entryKey: `DEADLANDS.Huckster.Backlash.${toPascal(entry.key)}.Label`,
      noteKey: `DEADLANDS.Huckster.Backlash.${toPascal(entry.key)}.Note`,
      hexSucceeds: entry.hexSucceeds,
      stunDamage: gateResult.stunDamage ?? null,
      stunUnconscious: gateResult.stunUnconscious ?? false,
      scartTotal: gateResult.scartTotal ?? null,
      marshalWindLost: gateResult.marshalWindLost ?? null,
    }
  );

  await ChatMessage.create({
    content,
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: ChatMessage.getSpeaker({ actor }),
  });

  return entry;
}

/**
 * Resolve a backlash row whose `hexSucceeds` outcome depends on a dice
 * check, per hnh p.101-102. Rows with no `gate` are returned unchanged.
 * @returns {{ hexSucceeds?: boolean, stunDamage?: number, stunUnconscious?: boolean, scartTotal?: number, marshalWindLost?: number }}
 */
function _resolveGate(actor, entry) {
  if (entry.gate === "stun") {
    // Damage dice here match _resolveManitouAttack's raw (non-exploding)
    // convention elsewhere in this file, for consistency within it.
    const damage = _rollRawDice(entry.damageDice, 6);
    const { unconscious } = _stunCheck(actor, damage);
    return { hexSucceeds: !unconscious, stunDamage: damage, stunUnconscious: unconscious };
  }
  if (entry.gate === "scart") {
    const scartTotal = _rollRawDice(entry.scartDice, 6);
    const scartEntry = lookupScart(scartTotal);
    // "Willies" or worse fails the hex; anything milder (Uneasy/Queasy) doesn't. hnh p.101.
    const failsHex = Boolean(scartEntry && scartEntry.min >= 7);
    return { hexSucceeds: !failsHex, scartTotal };
  }
  if (entry.gate === "marshal") {
    // dlc p.141: Wind-only knockout ("winded") has no formula — "it really
    // depends on the situation," the Marshal's call. Default to the hex
    // failing (matching this row's book-listed outcome); the chat card
    // flags the roll so the Marshal can override to a success.
    const windLost = _rollRawDice(entry.windDice, 6);
    return { hexSucceeds: false, marshalWindLost: windLost };
  }
  return {};
}

/**
 * Stun check after backlash damage: roll the character's Vigor against the
 * new wound's level, per dlc p.140-141. Busting means the character loses
 * consciousness. A hit that doesn't cause a wound (damage < Size) needs no
 * check — nothing happens per dlc p.140.
 * @returns {{ unconscious: boolean, woundLevel: number }}
 */
function _stunCheck(actor, damageTotal) {
  const size = actor.system.size ?? 6;
  const woundLevel = Math.min(5, woundsFromDamage(damageTotal, size));
  if (woundLevel <= 0) {
    return { unconscious: false, woundLevel: 0 };
  }
  const vigor = actor.system.traits?.vigor;
  const woundMod = actor.system.woundModifier ?? 0;
  const stunRoll = rollExplodingPool(vigor?.dieCount ?? 1, vigor?.dieType ?? "d6", {
    modifier: woundMod,
    tn: STUN_RECOVERY_TNS[woundLevel],
  });
  return { unconscious: stunRoll.bust, woundLevel };
}

/** Roll n×d6 (non-exploding) and return the total. */
function _rollRawDice(n, sides) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
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
