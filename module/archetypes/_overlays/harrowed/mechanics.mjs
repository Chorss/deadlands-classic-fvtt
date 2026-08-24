/**
 * Harrowed overlay — mechanics.
 *
 * Exports the pure `resolveDominionRoll` helper (unit-testable without Foundry)
 * and the Foundry-dependent `dominionRoll`, `activateHarrowed`, and
 * `deactivateHarrowed` workflows.
 *
 * Dominion Roll source: bod p.62 (player section), bod p.80-82 (Marshal).
 * Harrowed creation: dlc p.194, bod p.10-12.
 *
 * @license MIT
 */

import { ActionDeck, buildFullDeck, shuffleDeck } from "../../../core/cards/action-deck.mjs";
import { DIE_TYPES } from "../../../core/config.mjs";
import { rollExplodingPool } from "../../../core/dice/exploding-roll.mjs";
import { dieFace } from "../../../core/utils.mjs";

// ── Pure logic (testable without Foundry) ────────────────────────────────────

/**
 * Resolve a Dominion contest from pre-rolled values.
 *
 * Both sides roll Spirit (exploding) and add their current Dominion points.
 * The winner gains 1 point per success and 1 per raise, counted from the
 * *loser's own total* with no floor (dlc p.30: "Raises are always used in
 * opposed rolls, though they are counted from the opponent's total"). If
 * neither reaches TN 5, there is no change (bod p.80). A tie doesn't "beat"
 * the opponent either (dlc p.29: "the character who beats the TN and his
 * opponent wins") — bod doesn't override this for Dominion, so a tie is also
 * no change.
 *
 * @param {{
 *   pcRoll:       number,   // PC's Spirit roll result (highest die)
 *   pcDominion:   number,   // PC's current Dominion points
 *   npcRoll:      number,   // Manitou's Spirit roll result
 *   npcDominion:  number,   // Manitou's current Dominion points
 * }} params
 * @returns {{
 *   winner:       "pc" | "manitou" | "none",
 *   pcTotal:      number,
 *   npcTotal:     number,
 *   pointsGained: number,
 * }}
 */
export function resolveDominionRoll({ pcRoll, pcDominion, npcRoll, npcDominion }) {
  const TN = 5;
  const pcTotal = pcRoll + pcDominion;
  const npcTotal = npcRoll + npcDominion;

  // Neither side reached TN, or a tie (beats neither the TN's implied
  // opponent requirement) → no change. bod p.80; dlc p.29.
  if ((pcTotal < TN && npcTotal < TN) || pcTotal === npcTotal) {
    return { winner: "none", pcTotal, npcTotal, pointsGained: 0 };
  }

  if (pcTotal > npcTotal) {
    const raises = Math.floor((pcTotal - npcTotal) / 5);
    return { winner: "pc", pcTotal, npcTotal, pointsGained: 1 + raises };
  }

  const raises = Math.floor((npcTotal - pcTotal) / 5);
  return { winner: "manitou", pcTotal, npcTotal, pointsGained: 1 + raises };
}

/**
 * Determine the manitou's Spirit from a drawn card, per the Manitou Spirit
 * table (bod p.87, dlc p.194): 2 → Legion, 3-8 → same as the hero's Spirit,
 * 9-Jack → same die type +1 die, Queen-Ace → die type +1 step and +2 dice,
 * Joker → Greater Manitou.
 *
 * @param {{ rank: string, joker: string|null }} card
 * @param {{ dieCount: number, dieType: string }} pcSpirit
 * @returns {{ kind: "normal"|"legion"|"greater", dieCount: number, dieType: string }}
 */
export function manitouSpiritFromCard(card, pcSpirit) {
  const pcDieCount = pcSpirit?.dieCount ?? 1;
  const pcDieType = pcSpirit?.dieType ?? "d6";

  if (card?.joker) {
    // Greater Manitou: Spirit 3d12+4 — not a die pool, handled by the caller. bod p.87.
    return { kind: "greater", dieCount: 3, dieType: "d12" };
  }

  const rank = card?.rank;
  if (rank === "2") {
    return { kind: "legion", dieCount: pcDieCount, dieType: pcDieType };
  }
  if (["3", "4", "5", "6", "7", "8"].includes(rank)) {
    return { kind: "normal", dieCount: pcDieCount, dieType: pcDieType };
  }
  if (["9", "10", "J"].includes(rank)) {
    return { kind: "normal", dieCount: pcDieCount + 1, dieType: pcDieType };
  }
  // Queen-Ace: die type one step up, +2 dice.
  const stepIndex = Math.min(DIE_TYPES.length - 1, DIE_TYPES.indexOf(pcDieType) + 1);
  return { kind: "normal", dieCount: pcDieCount + 2, dieType: DIE_TYPES[stepIndex] ?? pcDieType };
}

// ── Foundry-dependent workflows ───────────────────────────────────────────────

/**
 * Roll Dominion at the start of a session (during sleep — NOT at combat start).
 * bod p.62 / bod p.80-82.
 *
 * @param {foundry.documents.Actor} actor
 * @returns {Promise<void>}
 */
export async function dominionRoll(actor) {
  const harrowed = actor.system.harrowed;
  if (!harrowed?.isHarrowed) {
    ui.notifications.warn(game.i18n.localize("DEADLANDS.Harrowed.Warn.NotHarrowed"));
    return;
  }

  const spirit = actor.system.traits.spirit;
  // Dominion pool = the character's Spirit die *face value* (d6→6, d8→8…),
  // not die count — confirmed by bod's pregen Harrowed templates (p.15-18),
  // which all show a pool of 6 for a d6 Spirit regardless of die count.
  // bod p.12 ties the Dominion pool size directly to the character's Spirit.
  const pool = dieFace(spirit?.dieType);
  const pcDominion = harrowed.dominion.spiritControl ?? 0;

  // Total Dominion — the manitou controls everything. No more session rolls
  // until the Marshal or magic intervenes. bod p.81.
  if (pcDominion <= 0) {
    ui.notifications.warn(
      game.i18n.format("DEADLANDS.Harrowed.Dominion.TotalDominion", { name: actor.name })
    );
    return;
  }

  const npcDominion = Math.max(0, pool - pcDominion);

  // PC rolls Spirit (exploding). bod p.62.
  const pcResult = rollExplodingPool(spirit?.dieCount ?? 1, spirit?.dieType ?? "d6", {
    modifier: 0,
    tn: 5,
  });

  // Manitou rolls its own Spirit, fixed at Harrowed creation (bod p.87) —
  // not re-derived from the PC's Spirit every check.
  const npcRoll = await _rollManitouSpirit(harrowed.dominion.manitouSpirit);

  const outcome = resolveDominionRoll({
    pcRoll: pcResult.highest,
    pcDominion,
    npcRoll,
    npcDominion,
  });

  // Update actor with new Dominion value and last roll record.
  let newSpiritControl = pcDominion;
  if (outcome.winner === "pc") {
    newSpiritControl = Math.min(pcDominion + outcome.pointsGained, pool);
  } else if (outcome.winner === "manitou") {
    newSpiritControl = Math.max(pcDominion - outcome.pointsGained, 0);
  }

  await actor.update({
    "system.harrowed.dominion.spiritControl": newSpiritControl,
    "system.harrowed.dominion.lastRoll": {
      pcRoll: pcResult.highest,
      pcDominion,
      pcTotal: outcome.pcTotal,
      npcRoll,
      npcDominion,
      npcTotal: outcome.npcTotal,
      winner: outcome.winner,
      pointsGained: outcome.pointsGained,
      newSpiritControl,
    },
  });

  // Post result to chat.
  const winnerKey =
    outcome.winner === "pc"
      ? "DEADLANDS.Harrowed.Dominion.PCWins"
      : outcome.winner === "manitou"
        ? "DEADLANDS.Harrowed.Dominion.ManitouWins"
        : "DEADLANDS.Harrowed.Dominion.NoChange";
  // Outcome colour follows who gained ground, not a fixed arcane purple:
  // the PC winning reads as success (green), the manitou winning as a
  // bust (blood); a stalemate keeps the neutral arcane accent (plum).
  const outcomeClass =
    outcome.winner === "pc" ? "success" : outcome.winner === "manitou" ? "bust" : "arcane";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="dlc-chat-card dlc-night ${outcomeClass} dlc-harrowed-dominion">
        <h3 class="dlc-roll-label">${game.i18n.localize("DEADLANDS.Harrowed.Dominion.Roll.Title")}</h3>
        <p><strong>${actor.name}</strong></p>
        <p>${game.i18n.format("DEADLANDS.Harrowed.Dominion.RollResult", {
          pcTotal: outcome.pcTotal,
          npcTotal: outcome.npcTotal,
        })}</p>
        <p class="dlc-outcome">${game.i18n.localize(winnerKey)}</p>
        <p>${game.i18n.format("DEADLANDS.Harrowed.Dominion.NewControl", {
          value: newSpiritControl,
        })}</p>
      </div>
    `,
  });
}

/**
 * Activate the Harrowed overlay on an actor. bod p.12:
 *   1. Draw a card to fix the manitou's Spirit, permanently, once.
 *   2. Run the creation Spirit contest: a plain opposed roll (no Dominion
 *      added yet — none exists before this contest establishes it). Unless
 *      the hero busts, start at half/half and shift by the contest's
 *      successes/raises. A bust gives the manitou Total Dominion outright.
 *
 * @param {foundry.documents.Actor} actor
 * @returns {Promise<void>}
 */
export async function activateHarrowed(actor) {
  const spirit = actor.system.traits.spirit;
  const pool = dieFace(spirit?.dieType); // "as many Dominion points as his Spirit." bod p.12.

  const card = await _drawSingleCard();
  const manitouSpirit = manitouSpiritFromCard(card, spirit);

  const pcResult = rollExplodingPool(spirit?.dieCount ?? 1, spirit?.dieType ?? "d6", {
    modifier: 0,
    tn: 5,
  });

  let startingControl;
  if (pcResult.bust) {
    // Busting the roll hands the manitou complete Dominion. bod p.12.
    startingControl = 0;
  } else {
    const half = Math.floor(pool / 2);
    const npcRoll = await _rollManitouSpirit(manitouSpirit);
    const outcome = resolveDominionRoll({
      pcRoll: pcResult.highest,
      pcDominion: 0,
      npcRoll,
      npcDominion: 0,
    });
    if (outcome.winner === "pc") {
      startingControl = Math.min(half + outcome.pointsGained, pool);
    } else if (outcome.winner === "manitou") {
      startingControl = Math.max(half - outcome.pointsGained, 0);
    } else {
      startingControl = half;
    }
  }

  await actor.update({
    "system.harrowed.isHarrowed": true,
    "system.harrowed.dominion.spiritControl": startingControl,
    "system.harrowed.dominion.lastRoll": null,
    "system.harrowed.dominion.manitouSpirit": manitouSpirit,
  });

  ui.notifications.info(game.i18n.format("DEADLANDS.Harrowed.Activated", { name: actor.name }));
}

// ── Manitou Spirit helpers ────────────────────────────────────────────────────

/**
 * Roll the manitou's Spirit for a Dominion contest.
 * @param {{ kind: "normal"|"legion"|"greater", dieCount: number, dieType: string }} [manitouSpirit]
 * @returns {Promise<number>}
 */
async function _rollManitouSpirit(manitouSpirit) {
  if (manitouSpirit?.kind === "greater") {
    // Spirit 3d12+4 — a flat roll, not a Trait-style die pool. bod p.87.
    return _rollRawDice(3, 12) + 4;
  }
  if (manitouSpirit?.kind === "legion") {
    // bod p.87: "draw a card to randomly determine [Legion's Spirit], just
    // like you would have with the original rules in the Deadlands
    // rulebook" — the referenced table is the character-creation Traits
    // Table (pg p.37, echoed for extras at dlc p.213-214): card rank sets
    // the die type, suit sets the die count (level).
    const card = await _drawSingleCard();
    const jokerSuitCard = card?.joker ? await _drawSingleCard() : null;
    const { dieCount, dieType } = _legionSpiritFromCard(card, () => jokerSuitCard);
    return rollExplodingPool(dieCount, dieType, { modifier: 0, tn: 5 }).highest;
  }
  return rollExplodingPool(manitouSpirit?.dieCount ?? 1, manitouSpirit?.dieType ?? "d6", {
    modifier: 0,
    tn: 5,
  }).highest;
}

/** Card rank → die type, per the Traits Table (pg p.37 / dlc p.213-214). */
function _dieTypeFromRank(rank) {
  if (rank === "2") {
    return "d4";
  }
  if (["Q", "K"].includes(rank)) {
    return "d10";
  }
  if (rank === "A") {
    return "d12";
  }
  if (["9", "10", "J"].includes(rank)) {
    return "d8";
  }
  return "d6"; // 3-8
}

/** Card suit → die count (Trait Level), per the Traits Table (pg p.37). */
function _dieCountFromSuit(suit) {
  return { clubs: 1, diamonds: 2, hearts: 3, spades: 4 }[suit] ?? 1;
}

/**
 * Legion's per-check Spirit draw (bod p.87), resolved against the Traits
 * Table (pg p.37 / dlc p.213-214): the card's rank sets the die type, its
 * suit sets the die count. A Joker counts as a d12 (pg p.37); its Level
 * comes from a second card's suit, per the Player's Guide "Joker Values" rule.
 * @param {{ rank: string|null, suit: string|null, joker: string|null }} card
 * @param {() => { rank: string|null, suit: string|null, joker: string|null }} drawAnother
 * @returns {{ dieCount: number, dieType: string }}
 */
function _legionSpiritFromCard(card, drawAnother) {
  if (card?.joker) {
    return { dieCount: _dieCountFromSuit(drawAnother()?.suit), dieType: "d12" };
  }
  return { dieCount: _dieCountFromSuit(card?.suit), dieType: _dieTypeFromRank(card?.rank) };
}

/** Draw a single card from the active combat's Action Deck, or a fresh local deck. */
async function _drawSingleCard() {
  const cards = game.combat
    ? await ActionDeck.deal(game.combat, 1)
    : shuffleDeck(buildFullDeck()).slice(0, 1);
  return cards[0];
}

/** Roll n×dSides (non-exploding) and return the total. */
function _rollRawDice(n, sides) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

/**
 * Deactivate the Harrowed overlay on an actor.
 *
 * @param {foundry.documents.Actor} actor
 * @returns {Promise<void>}
 */
export async function deactivateHarrowed(actor) {
  await actor.update({
    "system.harrowed.isHarrowed": false,
    "system.harrowed.dominion.spiritControl": 0,
    "system.harrowed.dominion.lastRoll": null,
  });
}
