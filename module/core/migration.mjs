/**
 * World-data migrations. A migration version is stamped only after every
 * document update succeeds, making interrupted runs safe to retry.
 *
 * @license MIT
 */

import {
  buildFaithDenialEffectData,
  FAITH_DENIAL_NAME_KEY,
  isFaithDenialEffect,
} from "../archetypes/blessed/faith-denial.mjs";

export const SYSTEM_ID = "deadlands-classic";
export const FAITH_DENIAL_MIGRATION_VERSION = "0.4.1";

const VALID_SEVERITIES = new Set(["minor", "major", "mortal"]);

function compareVersions(left, right) {
  const a = String(left || "0.0.0")
    .split(".")
    .map(Number);
  const b = String(right || "0.0.0")
    .split(".")
    .map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) {
      return Math.sign(difference);
    }
  }
  return 0;
}

/**
 * Produce the idempotent update plan for one plain Actor source object.
 * Deprecated fields remain in the 0.4.1 schema so this never needs `_source`.
 */
export function planFaithDenialMigration(actorData, worldTime, options = {}) {
  if (actorData?.type !== "blessed") {
    return { actorUpdate: null, effectData: null };
  }

  const system = actorData.system ?? {};
  const severity = system.faithDeniedSeverity;
  const deniedUntil = Number(system.faithDeniedUntil) || 0;
  const hasLegacyState = deniedUntil !== 0 || (severity && severity !== "none");
  if (!hasLegacyState) {
    return { actorUpdate: null, effectData: null };
  }

  const existingEffect = Array.from(actorData.effects ?? []).some(isFaithDenialEffect);
  const remaining = Math.max(0, Math.ceil(deniedUntil - worldTime));
  const shouldCreate = VALID_SEVERITIES.has(severity) && remaining > 0 && !existingEffect;

  return {
    actorUpdate: {
      "system.faithDeniedUntil": 0,
      "system.faithDeniedSeverity": "none",
    },
    effectData: shouldCreate
      ? buildFaithDenialEffectData(severity, remaining, {
          name: options.effectName ?? FAITH_DENIAL_NAME_KEY,
          startTime: worldTime,
        })
      : null,
  };
}

/** Apply the faith-denial bridge migration to a live Actor document. */
export async function migrateFaithDenialActor(actor, worldTime, effectName) {
  const plan = planFaithDenialMigration(actor.toObject(), worldTime, { effectName });
  if (plan.effectData) {
    await actor.createEmbeddedDocuments("ActiveEffect", [plan.effectData]);
  }
  if (plan.actorUpdate) {
    await actor.update(plan.actorUpdate);
  }
  return plan;
}

function collectWorldActors(gameInstance) {
  const actors = new Map();
  for (const actor of gameInstance.actors ?? []) {
    actors.set(actor.uuid, actor);
  }
  for (const scene of gameInstance.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor) {
        actors.set(token.actor.uuid, token.actor);
      }
    }
  }
  return actors.values();
}

/** Run all migrations pending for the active world. Active GM only. */
export async function migrateWorld(gameInstance = game) {
  if (!gameInstance.user?.isGM || !gameInstance.users?.activeGM?.isSelf) {
    return false;
  }

  const currentVersion = gameInstance.settings.get(SYSTEM_ID, "migrationVersion");
  if (compareVersions(currentVersion, FAITH_DENIAL_MIGRATION_VERSION) >= 0) {
    return false;
  }

  const effectName = gameInstance.i18n.localize(FAITH_DENIAL_NAME_KEY);
  const worldTime = gameInstance.time?.worldTime ?? 0;
  for (const actor of collectWorldActors(gameInstance)) {
    await migrateFaithDenialActor(actor, worldTime, effectName);
  }

  await gameInstance.settings.set(SYSTEM_ID, "migrationVersion", FAITH_DENIAL_MIGRATION_VERSION);
  return true;
}
