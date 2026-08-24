/**
 * Wind (Stamina points) helpers.
 *
 * Wind max = Vigor die face + Spirit die face. dlc p.40.
 * Wind recovery: 1/minute natural; Medicine TN 3 resets to full. dlc p.144.
 *
 * @license MIT
 */

/**
 * Compute the maximum Wind from the two trait die types.
 * Wind max = Vigor die face + Spirit die face. dlc p.40.
 *
 * @param {{ vigor: { dieType: string }, spirit: { dieType: string } }} traits
 * @returns {number}
 */
export function computeWindMax(traits) {
  const vigorFace = Number((traits.vigor?.dieType ?? "d6").slice(1));
  const spiritFace = Number((traits.spirit?.dieType ?? "d6").slice(1));
  return vigorFace + spiritFace;
}

/**
 * Whether the actor is currently Winded (Wind ≤ 0). dlc p.141.
 * Winded characters receive no initiative cards and take no actions.
 *
 * @param {number} windValue
 * @returns {boolean}
 */
export function isWinded(windValue) {
  return windValue <= 0;
}

/**
 * Negative Wind penalty: every interval of −startWind causes +1 wound to guts.
 * dlc p.141-142.
 *
 * Returns how many guts wounds the actor should receive for their current Wind
 * given their starting Wind max.
 *
 * @param {number} windValue  — current (may be negative)
 * @param {number} windMax    — maximum Wind (starting Wind)
 * @returns {number} — guts wounds owed (0 if not yet negative enough)
 */
export function gutsWoundsFromNegativeWind(windValue, windMax) {
  if (windValue >= 0 || windMax <= 0) {
    return 0;
  }
  return Math.floor(Math.abs(windValue) / windMax);
}

/**
 * Plan a Wind loss and count only the new negative-Wind thresholds crossed by
 * this loss. Thresholds are cumulative at -windMax, -2×windMax, and so on;
 * comparing the counts before and after prevents repeated wounds on later
 * updates. dlc p.141-142.
 *
 * @param {number} previousWind
 * @param {number} amount — non-negative Wind loss
 * @param {number} windMax
 * @returns {{ previousWind:number, newWind:number, thresholdsCrossed:number }}
 */
export function planWindLoss(previousWind, amount, windMax) {
  const loss = Math.max(0, amount);
  const newWind = previousWind - loss;
  const previousThresholds = gutsWoundsFromNegativeWind(previousWind, windMax);
  const newThresholds = gutsWoundsFromNegativeWind(newWind, windMax);
  return {
    previousWind,
    newWind,
    thresholdsCrossed: Math.max(0, newThresholds - previousThresholds),
  };
}

/** Segments in the sheet's Combat-tab Wind meter (styles/combat.css
 * `.dlc-wind-track`). A visual approximation, not 1 tick per Wind point —
 * windMax varies per character (Vigor + Spirit die faces), a fixed-length
 * bar cannot track it 1:1. */
export const WIND_TICK_COUNT = 18;

/**
 * Build the fill state for each Wind-meter tick: "" (empty) beyond the
 * current fill, otherwise a zone colour ("danger"/"warn"/"ok") by the
 * tick's position in the bar — a fuel-gauge read, not a literal per-point
 * Wind track (see WIND_TICK_COUNT). Negative Wind clamps to zero ticks
 * filled rather than a negative count.
 *
 * @param {number} windValue
 * @param {number} windMax
 * @returns {string[]} length WIND_TICK_COUNT, each "" | "danger" | "warn" | "ok"
 */
export function buildWindTicks(windValue, windMax) {
  const ratio = windMax > 0 ? Math.max(0, windValue) / windMax : 0;
  const filled = Math.round(Math.min(1, ratio) * WIND_TICK_COUNT);
  const zones = ["danger", "warn", "ok"];
  return Array.from({ length: WIND_TICK_COUNT }, (_, i) => {
    if (i >= filled) {
      return "";
    }
    return zones[Math.floor((i / WIND_TICK_COUNT) * zones.length)];
  });
}
