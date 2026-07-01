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

import { rollExplodingPool } from "../../../core/dice/exploding-roll.mjs";

// ── Pure logic (testable without Foundry) ────────────────────────────────────

/**
 * Resolve a Dominion contest from pre-rolled values.
 *
 * Both sides roll Spirit (exploding) and add their current Dominion points.
 * The winner gains 1 point per success and 1 per raise (vs. the loser's
 * modified total). If neither reaches TN 5, there is no change in Dominion.
 * bod p.80: "If neither opponent gets at least a 5 on this check, there is
 * no change in Dominion."
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

  // Neither side reached TN → no change. bod p.80.
  if (pcTotal < TN && npcTotal < TN) {
    return { winner: "none", pcTotal, npcTotal, pointsGained: 0 };
  }

  if (pcTotal >= npcTotal) {
    // PC wins (or ties — tie goes to the PC per standard Deadlands convention).
    const margin = pcTotal - Math.max(npcTotal, TN - 1);
    const raises = Math.floor(margin / 5);
    const pointsGained = 1 + raises;
    return { winner: "pc", pcTotal, npcTotal, pointsGained };
  }

  // Manitou wins.
  const margin = npcTotal - Math.max(pcTotal, TN - 1);
  const raises = Math.floor(margin / 5);
  const pointsGained = 1 + raises;
  return { winner: "manitou", pcTotal, npcTotal, pointsGained };
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
  const dieCount = spirit.dieCount ?? 1;
  const dieType = spirit.dieType ?? "d6";
  const pcDominion = harrowed.dominion.spiritControl ?? 0;

  // PC rolls Spirit (exploding). bod p.62.
  const pcResult = rollExplodingPool(dieCount, dieType, { modifier: 0, tn: 5 });

  // Manitou rolls Spirit — treated as fixed die (same die type as PC Spirit,
  // dieCount 1, Manitou has no Aptitudes). bod p.80.
  const manitouResult = rollExplodingPool(1, dieType, { modifier: 0, tn: 5 });
  // Dominion pool = Spirit die count; PC + Manitou hold complementary shares.
  // bod p.12: "the hero and the manitou start with half the total number of
  // Dominion points."
  const npcDominion = Math.max(0, (spirit.dieCount ?? 1) - pcDominion);

  const outcome = resolveDominionRoll({
    pcRoll: pcResult.highest,
    pcDominion,
    npcRoll: manitouResult.highest,
    npcDominion,
  });

  // Update actor with new Dominion value and last roll record.
  let newSpiritControl = pcDominion;
  if (outcome.winner === "pc") {
    newSpiritControl = Math.min(pcDominion + outcome.pointsGained, spirit.dieCount ?? 1);
  } else if (outcome.winner === "manitou") {
    newSpiritControl = Math.max(pcDominion - outcome.pointsGained, 0);
  }

  await actor.update({
    "system.harrowed.dominion.spiritControl": newSpiritControl,
    "system.harrowed.dominion.lastRoll": {
      pcRoll: pcResult.highest,
      pcDominion,
      npcRoll: manitouResult.highest,
      npcDominion,
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

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="dlc-chat-card harrowed-dominion">
        <h3>${game.i18n.localize("DEADLANDS.Harrowed.Dominion.Roll.Title")}</h3>
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
 * Activate the Harrowed overlay on an actor. Seeds Dominion at Spirit die value
 * / 2 (rounded down), per bod p.12.
 *
 * @param {foundry.documents.Actor} actor
 * @returns {Promise<void>}
 */
export async function activateHarrowed(actor) {
  const spirit = actor.system.traits.spirit;
  const dieCount = spirit?.dieCount ?? 1;
  // Both PC and Manitou start with half the total Dominion pool. bod p.12.
  const startingControl = Math.floor(dieCount / 2);

  await actor.update({
    "system.harrowed.isHarrowed": true,
    "system.harrowed.dominion.spiritControl": startingControl,
    "system.harrowed.dominion.lastRoll": null,
  });

  ui.notifications.info(game.i18n.format("DEADLANDS.Harrowed.Activated", { name: actor.name }));
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
