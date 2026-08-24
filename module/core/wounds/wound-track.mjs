/**
 * Wound-track helpers — pure accumulation logic + Foundry-integrated application.
 *
 * Mechanics verified against dlc p.138-142:
 *   - Wounds per hit = floor(damage / size). dlc p.138.
 *   - Wounds accumulate per location; storage caps at 5 (Maimed), while the
 *     application plan preserves overflow for Fate prevention. dlc p.139-140.
 *   - Gizzards/upperGuts/lowerGuts share one accumulation pool for severity
 *     purposes — see `gutsTotal`. dlc p.139 (docs/notes.md, resolved).
 *   - Wind per hit = woundAmount × 1d6 open-ended; minimum 1d6 even with 0 wounds. dlc p.141.
 *   - Wind ≤ 0 → Winded (no initiative cards, no actions). dlc p.141.
 *   - Bleeding per round: Serious −1 Wind, Critical −2 Wind, Maimed limb −3 Wind. dlc p.142.
 *   - Wind recovery: 1/minute naturally; Medicine TN 3 resets to full (~5 min). dlc p.144.
 *
 * `woundsFromDamage`, `planWoundApplication`, and the bleeding helpers are pure.
 * `applyWounds`, `tickBleeding`, `recoverWind` require a live Foundry actor.
 *
 * @license MIT
 */

import { HIT_LOCATIONS, WOUND_MAX, WOUND_PENALTIES } from "../config.mjs";
import { rollExplodingPool } from "../dice/exploding-roll.mjs";
import { planWindLoss } from "./wind-calculator.mjs";

const GUTS_LOCATIONS = Object.keys(HIT_LOCATIONS).filter((id) => HIT_LOCATIONS[id].gutsGroup);

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Compute how many wounds a hit inflicts. dlc p.138.
 *
 * @param {number} damageTotal — net damage after armor reduction
 * @param {number} [size=6]   — target's Size attribute (default 6)
 * @returns {number} — wound count (may be 0)
 */
export function woundsFromDamage(damageTotal, size = 6) {
  if (damageTotal <= 0 || size <= 0) {
    return 0;
  }
  return Math.floor(damageTotal / size);
}

/**
 * Preserve the full wound transaction before storage clamps severity at
 * Maimed. Fate prevention is represented in the plan even though its UI is a
 * later milestone. dlc p.139-140, p.147-148.
 *
 * @param {number} current — current severity (0–5)
 * @param {number} woundAmount — wounds caused by this hit
 * @param {object} [opts]
 * @param {number} [opts.preventedWounds=0]
 * @returns {{ woundAmount:number, preventedWounds:number, appliedWounds:number,
 *   totalBeforeCap:number, storedSeverity:number, overflow:number }}
 */
export function planWoundApplication(current, woundAmount, { preventedWounds = 0 } = {}) {
  const incoming = Math.max(0, woundAmount);
  const prevented = Math.min(incoming, Math.max(0, preventedWounds));
  const appliedWounds = incoming - prevented;
  const totalBeforeCap = Math.max(0, current) + appliedWounds;
  const storedSeverity = Math.min(WOUND_MAX, totalBeforeCap);
  return {
    woundAmount: incoming,
    preventedWounds: prevented,
    appliedWounds,
    totalBeforeCap,
    storedSeverity,
    overflow: Math.max(0, totalBeforeCap - WOUND_MAX),
  };
}

/**
 * Compatibility wrapper for callers that only need persisted severity. It is
 * insufficient for future Fate-spend transactions because it discards the
 * pre-cap total and overflow; new code should use planWoundApplication().
 */
export function accumulateWounds(current, adding) {
  return planWoundApplication(current, adding).storedSeverity;
}

/**
 * Wind lost per hit = woundAmount × 1d6 open-ended; minimum 1d6. dlc p.141.
 *
 * Pure: returns the die count so the caller can roll them.
 * @param {number} woundAmount
 * @returns {number} die count for the wind roll (≥ 1)
 */
export function windDiceCount(woundAmount) {
  return Math.max(1, woundAmount);
}

/**
 * Bleeding Wind drain per round for a given severity. dlc p.142.
 *
 * @param {number} severity — wound level for a single location
 * @param {boolean} [isLimb=false] — true for arm/leg locations (maimed limb +3/round)
 * @returns {number} — Wind points lost this round (0 if no bleed)
 */
export function getBleedingRate(severity, isLimb = false) {
  if (severity >= 5 && isLimb) {
    return 3; // Maimed limb
  }
  if (severity >= 4) {
    return 2; // Critical
  }
  if (severity >= 3) {
    return 1; // Serious
  }
  return 0;
}

/**
 * Combined severity across the shared guts pool (gizzards + upperGuts +
 * lowerGuts), capped at WOUND_MAX. dlc p.139: wounds to any of the three
 * accumulate together rather than as three independent 0-5 pools.
 *
 * @param {Record<string, { severity: number }>} woundLocations
 * @returns {number} — 0-5
 */
export function gutsTotal(woundLocations) {
  const sum = GUTS_LOCATIONS.reduce((s, loc) => s + (woundLocations[loc]?.severity ?? 0), 0);
  return Math.min(WOUND_MAX, sum);
}

/**
 * The highest wound penalty across all locations. dlc p.140. The three guts
 * sub-locations count as one shared pool (see `gutsTotal`) rather than three
 * independent severities, matching dlc p.139.
 * Used by prepareDerivedData as `woundModifier`.
 *
 * @param {Record<string, { severity: number }>} woundLocations
 * @returns {number} — penalty (0 or negative)
 */
export function highestWoundPenalty(woundLocations) {
  const pooledGuts = gutsTotal(woundLocations);
  const maxSeverity = Object.entries(woundLocations).reduce((max, [id, loc]) => {
    const severity = GUTS_LOCATIONS.includes(id) ? pooledGuts : (loc.severity ?? 0);
    return Math.max(max, severity);
  }, 0);
  return WOUND_PENALTIES[maxSeverity] ?? 0;
}

/**
 * Total bleeding Wind drain per round across all wound locations. dlc p.142.
 * The three guts sub-locations count once, via the shared pool (see
 * `gutsTotal`), rather than each contributing its own bleed rate — matching
 * how `highestWoundPenalty` already treats them as one location, and
 * avoiding triple-counting a single pooled wound.
 *
 * @param {Record<string, { severity: number }>} woundLocations
 * @returns {number} total Wind lost this round (>= 0)
 */
export function totalBleedingRate(woundLocations) {
  let total = 0;
  for (const [locId, locData] of Object.entries(woundLocations)) {
    if (GUTS_LOCATIONS.includes(locId)) {
      continue;
    }
    const isLimb = locId.endsWith("Arm") || locId.endsWith("Leg");
    total += getBleedingRate(locData.severity ?? 0, isLimb);
  }
  total += getBleedingRate(gutsTotal(woundLocations), false);
  return total;
}

function copyWounds(woundLocations) {
  const copy = {};
  for (const [id, data] of Object.entries(woundLocations ?? {})) {
    copy[id] = { severity: data?.severity ?? 0 };
  }
  for (const id of GUTS_LOCATIONS) {
    copy[id] ??= { severity: 0 };
  }
  return copy;
}

/** Apply a stored-severity plan to one location or the shared guts pool. */
function applyPlanToWounds(woundLocations, location, plan) {
  const next = copyWounds(woundLocations);
  if (GUTS_LOCATIONS.includes(location)) {
    const currentPool = gutsTotal(next);
    const delta = Math.max(0, plan.storedSeverity - currentPool);
    next[location].severity += delta;
  } else {
    next[location] ??= { severity: 0 };
    next[location].severity = plan.storedSeverity;
  }
  return next;
}

/** Plan Wind and the resulting canonical upper-guts threshold wounds. */
function planWindConsequences(actor, amount, woundLocations) {
  const previousWind = actor.system.wind?.value ?? actor.system.wind?.max ?? 0;
  const windMax = actor.system.wind?.max ?? 0;
  const wind = planWindLoss(previousWind, amount, windMax);
  const currentGuts = gutsTotal(woundLocations);
  const gutsWounds = planWoundApplication(currentGuts, wind.thresholdsCrossed);
  const wounds = applyPlanToWounds(woundLocations, "upperGuts", gutsWounds);
  return { wind, gutsWounds, wounds };
}

function woundUpdates(before, after) {
  const update = {};
  for (const [location, data] of Object.entries(after)) {
    if ((before?.[location]?.severity ?? 0) !== data.severity) {
      update[`system.wounds.${location}.severity`] = data.severity;
    }
  }
  return update;
}

// ── Foundry-integrated ────────────────────────────────────────────────────────

/**
 * Apply wounds to a location and roll Wind damage, then update the actor.
 *
 * @param {Actor} actor
 * @param {string} location — HIT_LOCATIONS key (e.g. "upperGuts", "leftArm")
 * @param {number} damageTotal — net damage after armor
 * @param {object} [opts]
 * @param {number} [opts.preventedWounds=0]
 * @param {() => number} [opts._rng]
 * @returns {Promise<object>} full wound plan plus Wind and threshold-wound data
 */
export async function applyWounds(
  actor,
  location,
  damageTotal,
  { preventedWounds = 0, _rng = Math.random } = {}
) {
  const size = actor.system.size ?? 6;
  const woundAmount = woundsFromDamage(damageTotal, size);

  const beforeWounds = copyWounds(actor.system.wounds ?? {});
  const current = GUTS_LOCATIONS.includes(location)
    ? gutsTotal(beforeWounds)
    : (beforeWounds[location]?.severity ?? 0);
  const woundPlan = planWoundApplication(current, woundAmount, { preventedWounds });
  const afterHitWounds = applyPlanToWounds(beforeWounds, location, woundPlan);

  // Wind roll: woundAmount × 1d6 open-ended (sum), min 1d6. dlc p.141.
  const dieCount = windDiceCount(woundPlan.appliedWounds);
  const windPool = rollExplodingPool(dieCount, "d6", { modifier: 0, tn: 1, _rng });
  const windLost = windPool.dice.reduce((sum, d) => sum + d.total, 0);

  const consequences = planWindConsequences(actor, windLost, afterHitWounds);

  await actor.update({
    ...woundUpdates(beforeWounds, consequences.wounds),
    "system.wind.value": consequences.wind.newWind,
  });

  return {
    ...woundPlan,
    newSeverity: woundPlan.storedSeverity,
    windLost,
    wind: consequences.wind,
    negativeWindWounds: consequences.wind.thresholdsCrossed,
    negativeWindWoundPlan: consequences.gutsWounds,
  };
}

/**
 * Apply a Wind loss and any newly crossed negative-Wind wounds in one actor
 * update. Threshold wounds always enter the shared guts pool at upperGuts.
 *
 * @param {Actor} actor
 * @param {number} amount
 * @returns {Promise<object>} Wind plan plus the threshold wound plan
 */
export async function applyWindLoss(actor, amount) {
  const beforeWounds = copyWounds(actor.system.wounds ?? {});
  const consequences = planWindConsequences(actor, amount, beforeWounds);
  await actor.update({
    ...woundUpdates(beforeWounds, consequences.wounds),
    "system.wind.value": consequences.wind.newWind,
  });
  return {
    ...consequences.wind,
    gutsWounds: consequences.gutsWounds,
  };
}

/**
 * Apply per-round bleeding drain for all wounded locations. dlc p.142.
 * Call once per combat round (e.g. from combat turn hook).
 *
 * @param {Actor} actor
 * @returns {Promise<number>} total Wind lost this tick
 */
export async function tickBleeding(actor) {
  const totalDrain = totalBleedingRate(actor.system.wounds ?? {});

  if (totalDrain > 0) {
    await applyWindLoss(actor, totalDrain);
  }

  return totalDrain;
}

/**
 * Natural Wind recovery: +1/minute. dlc p.144.
 * Called from a time-advancement hook or manually by the GM.
 *
 * @param {Actor} actor
 * @param {number} [minutes=1]
 * @returns {Promise<number>} new wind.value
 */
export async function recoverWind(actor, minutes = 1) {
  const current = actor.system.wind?.value ?? 0;
  const max = actor.system.wind?.max ?? current;
  const recovered = Math.min(max, current + minutes);
  await actor.update({ "system.wind.value": recovered });
  return recovered;
}
