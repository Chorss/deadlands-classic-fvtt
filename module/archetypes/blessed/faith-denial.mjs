/**
 * Active Effects V2 representation of a Blessed character's temporary loss
 * of miracle access.
 *
 * @license MIT
 */

export const FAITH_DENIAL_FLAG_SCOPE = "deadlands-classic";
export const FAITH_DENIAL_FLAG_KEY = "faithDenial";
export const FAITH_DENIAL_ICON = "icons/svg/holy-shield.svg";
export const FAITH_DENIAL_NAME_KEY = "DEADLANDS.Blessed.Effect.FaithDenial";

const VALID_SEVERITIES = new Set(["minor", "major", "mortal"]);

/** Return the normalized severity stored on a marked effect, or null. */
export function faithDenialSeverity(effect) {
  const severity = effect?.flags?.[FAITH_DENIAL_FLAG_SCOPE]?.[FAITH_DENIAL_FLAG_KEY]?.severity;
  return VALID_SEVERITIES.has(severity) ? severity : null;
}

/** Whether an effect belongs to this system's faith-denial workflow. */
export function isFaithDenialEffect(effect) {
  return faithDenialSeverity(effect) !== null;
}

/**
 * Locate the one currently applicable faith-denial effect on an actor.
 * V14's `active` getter incorporates both `disabled` and native duration
 * suppression. The explicit fallbacks keep this helper usable with plain
 * objects in migration tests.
 */
export function getActiveFaithDenialEffect(actor) {
  return Array.from(actor?.effects ?? []).find((effect) => {
    if (!isFaithDenialEffect(effect) || effect.disabled) {
      return false;
    }
    if (effect.duration?.expired || effect.duration?.remaining <= 0) {
      return false;
    }
    return effect.active !== false;
  });
}

/** Build V14 Active Effect source data for a denial lasting `seconds`. */
export function buildFaithDenialEffectData(severity, seconds, options = {}) {
  const normalizedSeverity = VALID_SEVERITIES.has(severity) ? severity : "minor";
  return {
    name: options.name ?? game.i18n.localize(FAITH_DENIAL_NAME_KEY),
    img: FAITH_DENIAL_ICON,
    duration: {
      value: Math.max(0, Math.ceil(seconds)),
      units: "seconds",
      expiry: null,
    },
    ...(Number.isFinite(options.startTime)
      ? { start: { time: Math.trunc(options.startTime) } }
      : {}),
    system: { changes: [] },
    flags: {
      [FAITH_DENIAL_FLAG_SCOPE]: {
        [FAITH_DENIAL_FLAG_KEY]: { severity: normalizedSeverity },
      },
    },
  };
}

/** Replace every prior marked denial with one newly-timed effect. */
export async function replaceFaithDenialEffect(actor, severity, seconds) {
  const priorIds = Array.from(actor.effects ?? [])
    .filter(isFaithDenialEffect)
    .map((effect) => effect.id ?? effect._id)
    .filter(Boolean);
  if (priorIds.length) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", priorIds);
  }
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
    buildFaithDenialEffectData(severity, seconds),
  ]);
  return effect;
}
