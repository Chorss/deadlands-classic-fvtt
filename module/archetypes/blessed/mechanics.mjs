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
 * Sin severity → i18n key describing the miracle access denial duration.
 * fb p.103-104. Values are localized via {@link sinDenialLabel}, not read
 * directly — this repo requires no hardcoded UI strings.
 * @type {Record<string, string>}
 */
export const SIN_DENIAL_LABEL_KEYS = {
  minor: "DEADLANDS.Blessed.Sin.Duration.Minor",
  major: "DEADLANDS.Blessed.Sin.Duration.Major",
  mortal: "DEADLANDS.Blessed.Sin.Duration.Mortal",
};

/**
 * Localized denial-duration label for a sin severity, or "" if unknown.
 * @param {string} severity — "minor" | "major" | "mortal"
 * @returns {string}
 */
export function sinDenialLabel(severity) {
  const key = SIN_DENIAL_LABEL_KEYS[severity];
  return key ? game.i18n.localize(key) : "";
}

/**
 * Sin severity → miracle access denial duration in seconds (game.time.worldTime
 * units), matching SIN_DENIAL_LABEL_KEYS. fb p.103-104 (Crime & Punishment table).
 * @type {Record<string, number>}
 */
const SECONDS_PER_HOUR = 3600;
export const SIN_DENIAL_SECONDS = {
  minor: SECONDS_PER_HOUR,
  major: SECONDS_PER_HOUR * 24,
  mortal: SECONDS_PER_HOUR * 24 * 7,
};

/**
 * Whether the patron currently denies this actor access to miracles/gifts.
 * fb p.104: denial lifts automatically once its duration elapses — no
 * atonement roll or action is required to end it early.
 *
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isMiracleAccessDenied(actor) {
  const severity = actor.system.faithDeniedSeverity ?? "none";
  if (severity === "none") {
    return false;
  }
  const until = actor.system.faithDeniedUntil ?? 0;
  return (game.time?.worldTime ?? 0) < until;
}

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
  if (isMiracleAccessDenied(actor)) {
    ui.notifications.warn(
      game.i18n.format("DEADLANDS.Blessed.Warn.AccessDenied", {
        name: actor.name,
        label: sinDenialLabel(actor.system.faithDeniedSeverity),
      })
    );
    return;
  }

  // Denial window elapsed but the flag/timestamp weren't cleared yet — lift it
  // now instead of leaving stale state on the actor. fb p.104 (automatic lift).
  if ((actor.system.faithDeniedSeverity ?? "none") !== "none") {
    await actor.update({ "system.faithDeniedSeverity": "none", "system.faithDeniedUntil": 0 });
  }

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
  const denialLabel = sinDenialLabel(severity) || sinDenialLabel("minor");
  const denialSeconds = SIN_DENIAL_SECONDS[severity] ?? SIN_DENIAL_SECONDS.minor;

  const traitData = actor.system.traits?.spirit;
  const spiritDie = traitData?.dieType ?? "d6";
  const spiritDieCount = traitData?.dieCount ?? 1;

  // Patron immediately denies miracle access for the duration. fb p.103-104.
  await actor.update({
    "system.faithDeniedSeverity": severity,
    "system.faithDeniedUntil": (game.time?.worldTime ?? 0) + denialSeconds,
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
