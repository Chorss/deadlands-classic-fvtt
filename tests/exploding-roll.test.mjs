/**
 * Unit tests for module/core/dice/exploding-roll.mjs.
 * Pure logic — no Foundry runtime needed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rollExplodingPool } from "../module/core/dice/exploding-roll.mjs";

/** Build a deterministic RNG that returns values from a fixed sequence. */
function _makeRng(...values) {
  let i = 0;
  // Convert face-value to [0,1) as the code does: 1 + floor(rng()*faces) = value
  // So rng() = (value - 1) / faces (for faces, use the last die we set up)
  // Instead, return raw floats directly.
  return () => values[i++ % values.length];
}

/**
 * Build a raw-float RNG: given desired die values, produce the [0,1) float that
 * yields each value via `1 + Math.floor(rng() * faces)`.
 * For value V on a die with F faces: rng() should be in [( V-1)/F, V/F).
 * We return (V - 1) / F + epsilon.
 */
function rngFor(faces, ...desiredValues) {
  const floats = desiredValues.map((v) => (v - 1) / faces + Number.EPSILON);
  let i = 0;
  return () => floats[i++ % floats.length];
}

describe("rollExplodingPool", () => {
  it("returns highest die, not the sum", () => {
    // 3d6: rolls 2, 4, 6 (max on d6 → ace to 3 → total 9)
    // Expected highest = 9 (the aced die). dlc p.27.
    const rng = rngFor(6, 2, 4, 6, 3); // 3rd die aces, reroll = 3 → total 9
    const result = rollExplodingPool(3, "d6", { tn: 5, _rng: rng });
    assert.equal(result.dice[2].total, 9, "aced die should total 9");
    assert.equal(result.highest, 9, "highest should be the aced die");
    assert.equal(result.dice[0].total, 2);
    assert.equal(result.dice[1].total, 4);
  });

  it("chains aces without limit", () => {
    // d6: 6 → 6 → 3 (two aces, total = 15). dlc p.28.
    const rng = rngFor(6, 6, 6, 3);
    const result = rollExplodingPool(1, "d6", { tn: 5, _rng: rng });
    assert.equal(result.dice[0].aces, 2);
    assert.equal(result.dice[0].total, 15);
    assert.equal(result.highest, 15);
  });

  it("detects a bust when more 1s than non-1s", () => {
    // 3d6: 1, 1, 4 — two 1s vs one non-1 → bust. dlc p.29-30.
    const rng = rngFor(6, 1, 1, 4);
    const result = rollExplodingPool(3, "d6", { tn: 5, _rng: rng });
    assert.equal(result.bust, true);
    assert.equal(result.success, false);
    assert.equal(result.raises, 0);
  });

  it("does NOT bust when ones equal non-ones", () => {
    // 2d6: 1, 4 — one 1, one non-1 → not a bust (not MORE). dlc p.29-30.
    const rng = rngFor(6, 1, 4);
    const result = rollExplodingPool(2, "d6", { tn: 5, _rng: rng });
    assert.equal(result.bust, false);
  });

  it("counts raises at floor((highest - tn) / 5)", () => {
    // 1d8: rolls 5 → highest = 5, tn = 5 → success, 0 raises. dlc p.29.
    const r0 = rollExplodingPool(1, "d8", { tn: 5, _rng: rngFor(8, 5) });
    assert.equal(r0.success, true);
    assert.equal(r0.raises, 0);

    // 1d8: rolls 7 → highest+mod = 11 (mod+4), tn=5 → raises = floor(6/5) = 1
    const r1 = rollExplodingPool(1, "d8", { modifier: 4, tn: 5, _rng: rngFor(8, 7) });
    assert.equal(r1.highest, 11);
    assert.equal(r1.raises, 1);

    // 1d12: rolls 10 → highest = 10, tn = 5 → raises = floor(5/5) = 1
    const r2 = rollExplodingPool(1, "d12", { tn: 5, _rng: rngFor(12, 10) });
    assert.equal(r2.raises, 1);
  });

  it("applies modifier to the highest result", () => {
    // 1d6: rolls 3 → highest = 3 + (-2) = 1, below tn=5 → fail
    const rng = rngFor(6, 3);
    const result = rollExplodingPool(1, "d6", { modifier: -2, tn: 5, _rng: rng });
    assert.equal(result.highest, 1);
    assert.equal(result.success, false);
  });

  it("a single-die roll of 1 is a bust", () => {
    // With 1 die showing 1: ones=1, non-ones=0, 1 > 0 → bust. dlc p.29.
    const rng = rngFor(6, 1);
    const result = rollExplodingPool(1, "d6", { tn: 5, _rng: rng });
    assert.equal(result.bust, true);
  });

  it("throws on invalid dieType", () => {
    assert.throws(() => rollExplodingPool(1, "d0", {}), RangeError);
    assert.throws(() => rollExplodingPool(1, "dx", {}), RangeError);
  });

  it("throws on dieCount < 1", () => {
    assert.throws(() => rollExplodingPool(0, "d6", {}), RangeError);
  });
});
