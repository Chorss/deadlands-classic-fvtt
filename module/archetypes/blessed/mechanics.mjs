/**
 * Blessed miracle-invoking mechanics.
 *
 * invokeMiracle(actor, miracleItem, opts) — full workflow:
 *   faith roll (level × Spirit die) vs miracle.tn
 *   success → miracle activates
 *   failure during a sinful act → sin pending (patron denies access temporarily)
 *
 * trackSin(actor, severity) — explicit sin resolution:
 *   Spirit roll vs sin TN → failure = −1 faith level
 *   Patron temporarily denies miracle access for sinSeverity duration.
 *
 * Sources: dlc p.177-181; fb p.35-36, p.103-105.
 *
 * @license MIT
 */

import { rollExplodingPool } from "../../core/dice/exploding-roll.mjs";

/**
 * Sin severity → TN for the Spirit roll that avoids faith loss. fb p.103-104.
 * @type {Record<string, number>}
 */
export const SIN_TNS = {
  minor: 5,
  major: 9,
  mortal: 11,
};

/**
 * Sin severity → description of the miracle access denial duration. fb p.103-104.
 * @type {Record<string, string>}
 */
export const SIN_DENIAL_LABELS = {
  minor: "1 hour",
  major: "1 day",
  mortal: "1 week",
};

// ── Miracle invocation workflow ───────────────────────────────────────────────

/**
 * Full miracle-invoking workflow. dlc p.177; fb p.35.
 *
 * @param {Actor} actor — Blessed actor
 * @param {Item} miracleItem — the miracle being invoked
 * @param {{ modifier?: number, whiteSpend?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function invokeMiracle(actor, miracleItem, opts = {}) {
  const modifier = opts.modifier ?? 0;
  const whiteSpend = opts.whiteSpend ?? 0;

  const { level: faithLevel = 0, modifier: faithMod = 0 } = actor.system.faith ?? {};
  const traitData = actor.system.traits?.spirit;
  const spiritDie = traitData?.dieType ?? "d6";
  const dieCount = Math.max(1, faithLevel + whiteSpend);
  const tn = miracleItem.system.tn ?? 5;

  const rollResult = rollExplodingPool(dieCount, spiritDie, { modifier: modifier + faithMod, tn });

  await _sendMiracleMessage(actor, miracleItem, rollResult, {
    miraculSucceeds: !rollResult.bust && rollResult.total >= tn,
  });

  if (rollResult.bust) {
    // Bust on a faith roll = lose 1 faith if not already at 0. dlc p.177.
    await _applyFaithLoss(actor);
  }
}

// ── Sin tracking ─────────────────────────────────────────────────────────────

/**
 * Resolve a sin. Called when the actor sins (commits an act against their faith).
 * Immediately denies miracle access for the duration, then Spirit roll vs TN;
 * failure = −1 faith level. fb p.103-104; dlc p.177.
 *
 * @param {Actor} actor
 * @param {"minor"|"major"|"mortal"} severity
 * @returns {Promise<void>}
 */
export async function trackSin(actor, severity = "minor") {
  const sinTN = SIN_TNS[severity] ?? 5;
  const denialLabel = SIN_DENIAL_LABELS[severity] ?? "1 hour";

  const traitData = actor.system.traits?.spirit;
  const spiritDie = traitData?.dieType ?? "d6";
  const spiritDieCount = traitData?.dieCount ?? 1;

  // Patron immediately denies miracle access for the duration. fb p.103-104.
  await actor.update({
    "system.faithDeniedSeverity": severity,
    "system.sinPending": false,
  });

  // Spirit roll vs sin TN — failure = lose 1 faith. dlc p.177.
  const spiritRoll = rollExplodingPool(spiritDieCount, spiritDie, { modifier: 0, tn: sinTN });

  const faithLost = spiritRoll.bust || spiritRoll.total < sinTN;
  if (faithLost) {
    await _applyFaithLoss(actor);
  }

  await _sendSinMessage(actor, severity, spiritRoll, faithLost, denialLabel);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Subtract 1 from faith level, floor at 0. dlc p.177. */
async function _applyFaithLoss(actor) {
  const current = actor.system.faith?.level ?? 0;
  if (current <= 0) {
    return;
  }
  await actor.update({ "system.faith.level": current - 1 });
}

/** Post the miracle invocation result to chat. */
async function _sendMiracleMessage(actor, miracleItem, rollResult, meta) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/miracle-result.hbs",
    {
      actorName: actor.name,
      miracleName: miracleItem.name,
      rollResult,
      miracleSucceeds: meta.miraculSucceeds,
    }
  );

  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

/** Post the sin resolution to chat (whisper to GM). */
async function _sendSinMessage(actor, severity, spiritRoll, faithLost, denialLabel) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/sin-result.hbs",
    {
      actorName: actor.name,
      severity,
      spiritRoll,
      faithLost,
      denialLabel,
      sinTN: SIN_TNS[severity],
    }
  );

  await ChatMessage.create({
    content,
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}
