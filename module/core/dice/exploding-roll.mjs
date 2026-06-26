/**
 * Exploding-dice (Aces) pool for Deadlands Classic.
 *
 * Mechanics (dlc p.27-30):
 *   - Roll dieCount dice of dieType; each die that shows its max face "aces" —
 *     reroll that same die and add to its running total. Chains without limit.
 *   - Result = highest individual die total (NOT the sum of the pool). dlc p.27.
 *   - Bust = count of initial 1s is greater than count of non-1s. dlc p.29-30.
 *   - Raises = floor((highest - TN) / 5) when the roll succeeds. dlc p.29.
 *
 * All functions are pure (injectable RNG) so they can be unit-tested without
 * the Foundry runtime. Pass `_rng` in opts to override the default Math.random.
 *
 * @see tests/exploding-roll.test.mjs
 * @license MIT
 */

/**
 * @typedef {{ initialRoll: number, total: number, aces: number }} DieResult
 *   initialRoll — the first face value (used for bust detection)
 *   total       — sum of all rolls for this die (including Ace chain)
 *   aces        — how many times this die exploded
 */

/**
 * @typedef {{
 *   dice: DieResult[],
 *   highest: number,
 *   modifier: number,
 *   tn: number,
 *   bust: boolean,
 *   success: boolean,
 *   raises: number,
 *   aces: number,
 * }} PoolResult
 */

/**
 * Roll one die with chaining Aces. dlc p.28.
 * @param {number} faces — number of sides (e.g. 8 for d8)
 * @param {() => number} rng — returns a value in [0, 1)
 * @returns {DieResult}
 */
function rollOneDie(faces, rng) {
  const initialRoll = 1 + Math.floor(rng() * faces);
  let total = initialRoll;
  let aces = 0;

  if (initialRoll === faces) {
    aces = 1;
    let r;
    do {
      r = 1 + Math.floor(rng() * faces);
      total += r;
      if (r === faces) aces++;
    } while (r === faces);
  }

  return { initialRoll, total, aces };
}

/**
 * Roll an exploding pool of `dieCount` dice of `dieType`.
 *
 * @param {number} dieCount — number of dice (e.g. 4)
 * @param {string} dieType  — die face string: "d4"|"d6"|"d8"|"d10"|"d12"
 * @param {object} [opts]
 * @param {number} [opts.modifier=0] — flat modifier applied to the highest result
 * @param {number} [opts.tn=5]       — target number for success/raises
 * @param {() => number} [opts._rng] — injectable RNG (default: Math.random)
 * @returns {PoolResult}
 */
export function rollExplodingPool(
  dieCount,
  dieType,
  { modifier = 0, tn = 5, _rng = Math.random } = {}
) {
  const faces = Number(dieType.slice(1));
  if (!faces || faces < 2) throw new RangeError(`Invalid dieType: ${dieType}`);
  if (dieCount < 1) throw new RangeError(`dieCount must be ≥ 1, got ${dieCount}`);

  const dice = Array.from({ length: dieCount }, () => rollOneDie(faces, _rng));

  // Bust: more initial 1s than non-1s. dlc p.29-30.
  const ones = dice.filter((d) => d.initialRoll === 1).length;
  const bust = ones > dieCount - ones;

  // Highest: best individual die total + flat modifier. dlc p.27.
  const rawHighest = Math.max(...dice.map((d) => d.total));
  const highest = rawHighest + modifier;

  // Success and raises. dlc p.29.
  const success = !bust && highest >= tn;
  const raises = success ? Math.floor((highest - tn) / 5) : 0;
  const aces = dice.reduce((sum, d) => sum + d.aces, 0);

  return { dice, highest, modifier, tn, bust, success, raises, aces };
}
