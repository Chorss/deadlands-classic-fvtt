/**
 * Shaman ritual and favor mechanics.
 *
 * performRitual(actor, favorItem, opts) — earn Appeasement points:
 *   roll ritual level × associated Trait die vs favor.ritualTN
 *   success → earn (1 + raises) Appeasement points
 *   bust → manitou attacks: draw card for Spirit, opposed roll → 3d6+1d6/raise guts damage
 *   Points are added to appeasement.current (up to appeasement.max = guardianSpirit level).
 *   Without Guardian Spirit (guardianSpirit = 0), favor must be specified first and
 *   Appeasement is immediately spent. ghost-dancers p.57.
 *
 * spendFavor(actor, favorItem) — invoke a favor by spending Appeasement:
 *   checks current ≥ appeasementCost, deducts, posts chat card.
 *
 * Sources: dlc p.182-192; ghost-dancers p.49-76 (primary, overrides dlc where they conflict).
 *
 * @license MIT
 */

import { ActionDeck, buildFullDeck, shuffleDeck } from "../../core/cards/action-deck.mjs";
import { rollExplodingPool } from "../../core/dice/exploding-roll.mjs";

/**
 * Trait associated with each ritual type. ghost-dancers p.71-76.
 * @type {Record<string, string>}
 */
export const RITUAL_TRAITS = {
  dance: "nimbleness",
  fast: "vigor",
  peyote: "vigor",
  bodyPainting: "cognition",
  pledge: "knowledge",
  scar: "vigor",
  animalSacrifice: "nimbleness",
  spiritSong: "spirit",
};

// ── Ritual performance workflow ───────────────────────────────────────────────

/**
 * Perform a ritual to earn Appeasement points. ghost-dancers p.56-57; dlc p.185.
 *
 * @param {Actor} actor — Shaman actor
 * @param {Item} favorItem — the favor being sought
 * @param {{ modifier?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function performRitual(actor, favorItem, opts = {}) {
  const modifier = opts.modifier ?? 0;
  const { level: ritualLevel = 0, modifier: ritualMod = 0 } = actor.system.ritual ?? {};
  const ritualType = favorItem.system.ritualType ?? "dance";
  const associatedTrait = favorItem.system.ritualTrait ?? RITUAL_TRAITS[ritualType] ?? "nimbleness";
  const traitDie = actor.system.traits?.[associatedTrait]?.dieType ?? "d6";
  const tn = favorItem.system.ritualTN ?? 5;

  const rollResult = rollExplodingPool(Math.max(1, ritualLevel), traitDie, {
    modifier: modifier + ritualMod,
    tn,
  });

  if (rollResult.bust) {
    // Bust → manitou attacks. ghost-dancers p.57.
    const manitouDamage = await _resolveManitouAttack(actor);
    await _sendRitualMessage(actor, favorItem, rollResult, {
      earned: 0,
      bust: true,
      manitouDamage,
    });
    return;
  }

  const earned = rollResult.total >= tn ? 1 + rollResult.raises : 0;
  if (earned > 0) {
    await _applyAppeasementOrFavor(actor, favorItem, earned);
  }

  await _sendRitualMessage(actor, favorItem, rollResult, {
    earned,
    bust: false,
    manitouDamage: null,
  });
}

/**
 * Store earned Appeasement points or immediately spend them on a favor.
 * ghost-dancers p.50 (store) and p.57 (immediate spend without guardian spirit).
 */
async function _applyAppeasementOrFavor(actor, favorItem, earned) {
  const guardianSpirit = actor.system.guardianSpirit ?? 0;
  if (guardianSpirit > 0) {
    const current = actor.system.appeasement?.current ?? 0;
    await actor.update({
      "system.appeasement.current": Math.min(current + earned, guardianSpirit),
      "system.appeasement.max": guardianSpirit,
    });
  } else if (earned >= (favorItem.system.appeasementCost ?? 1)) {
    await _applyFavorEffect(actor, favorItem);
  }
}

/**
 * Spend stored Appeasement to invoke a favor. ghost-dancers p.50.
 *
 * @param {Actor} actor — Shaman actor with Guardian Spirit
 * @param {Item} favorItem — the favor to invoke
 * @returns {Promise<void>}
 */
export async function spendFavor(actor, favorItem) {
  const cost = favorItem.system.appeasementCost ?? 1;
  const current = actor.system.appeasement?.current ?? 0;

  if (current < cost) {
    ui.notifications?.warn(
      game.i18n.format("DEADLANDS.Shaman.Warn.InsufficientAppeasement", {
        name: actor.name,
        cost,
        current,
      })
    );
    return;
  }

  await actor.update({ "system.appeasement.current": current - cost });
  await _applyFavorEffect(actor, favorItem);

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/ritual-result.hbs",
    {
      actorName: actor.name,
      favorName: favorItem.name,
      rollResult: null,
      earned: 0,
      cost,
      favorGranted: true,
      bust: false,
      manitouDamage: null,
      spendOnly: true,
    }
  );
  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Manitou attack on bust: draw 1 card for manitou Spirit, opposed roll.
 * Damage: 3d6 + 1d6/raise to guts location. ghost-dancers p.57.
 */
async function _resolveManitouAttack(actor) {
  const cards = game.combat
    ? ActionDeck.deal(game.combat, 1)
    : shuffleDeck(buildFullDeck()).slice(0, 1);
  const card = cards[0];

  // Card rank maps to die face: Ace=14,K=13,Q=12,J=11,10-2 face value, Joker=20.
  const manitouSpirit = _cardToSpirit(card);

  // Shaman defends with ritual level × spirit die (dlc p.185: may use ritual instead of faith).
  const { level: ritualLevel = 0 } = actor.system.ritual ?? {};
  const spiritDie = actor.system.traits?.spirit?.dieType ?? "d6";
  const shamanRoll = rollExplodingPool(Math.max(1, ritualLevel), spiritDie, {
    modifier: 0,
    tn: manitouSpirit,
  });

  // Manitou wins if shaman fails to beat manitouSpirit. ghost-dancers p.57.
  const shamanWins = !shamanRoll.bust && shamanRoll.total >= manitouSpirit;

  let damage = null;
  if (!shamanWins) {
    // 3d6 base + 1d6 per raise the manitou got. ghost-dancers p.57.
    // Raises are counted from the shaman's roll total (opposed contest). ghost-dancers p.57.
    const manitouRaises = Math.max(
      0,
      Math.floor((manitouSpirit - (shamanRoll.bust ? 0 : shamanRoll.total)) / 5)
    );
    damage = _rollRawDice(3 + manitouRaises, 6);
  }

  return { card, manitouSpirit, shamanRoll, shamanWins, damage };
}

function _cardToSpirit(card) {
  if (!card) {
    return 10;
  }
  if (card.joker) {
    return 20;
  }
  const faceMap = { A: 14, K: 13, Q: 12, J: 11 };
  const rank = card.rank;
  return faceMap[rank] ?? (parseInt(rank, 10) || 10);
}

/** Roll n×d6 (non-exploding) and return the total. */
function _rollRawDice(n, sides) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

/** Placeholder: actual favor effects are GM-applied; we just notify. */
async function _applyFavorEffect(actor, favorItem) {
  await ChatMessage.create({
    content: game.i18n.format("DEADLANDS.Shaman.Chat.FavorGranted", {
      name: actor.name,
      favor: favorItem.name,
    }),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

/** Post the ritual result to chat. */
async function _sendRitualMessage(actor, favorItem, rollResult, meta) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/ritual-result.hbs",
    {
      actorName: actor.name,
      favorName: favorItem.name,
      rollResult,
      earned: meta.earned,
      cost: favorItem.system.appeasementCost ?? 1,
      favorGranted:
        meta.earned >= (favorItem.system.appeasementCost ?? 1) &&
        !meta.bust &&
        (actor.system.guardianSpirit ?? 0) === 0,
      bust: meta.bust,
      manitouDamage: meta.manitouDamage,
      spendOnly: false,
    }
  );

  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}
