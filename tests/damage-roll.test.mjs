/**
 * Unit tests for the pure Armor helpers in damage-roll.mjs.
 * rollDamage() itself touches Foundry (ChatMessage, game.i18n) and is verified
 * manually; all the non-trivial math lives in these two pure functions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyArmorDieReduction, applyLightArmorFlat } from "../module/core/dice/damage-roll.mjs";

describe("applyArmorDieReduction (dlc p.136)", () => {
  it("no reduction when armorLevel is 0", () => {
    assert.deepEqual(applyArmorDieReduction(3, "d6", 0), { dieCount: 3, dieType: "d6" });
  });

  it("steps d20 down to d12 at armor level 1", () => {
    assert.deepEqual(applyArmorDieReduction(2, "d20", 1), { dieCount: 2, dieType: "d12" });
  });

  it("steps d20 down to d10 at armor level 2", () => {
    assert.deepEqual(applyArmorDieReduction(2, "d20", 2), { dieCount: 2, dieType: "d10" });
  });

  it("reduces 3d6 to 3d4 at armor level 1 (worked example, dlc p.136)", () => {
    assert.deepEqual(applyArmorDieReduction(3, "d6", 1), { dieCount: 3, dieType: "d4" });
  });

  it("reduces 3d6 to 2d4 at armor level 2 (worked example, dlc p.136)", () => {
    assert.deepEqual(applyArmorDieReduction(3, "d6", 2), { dieCount: 2, dieType: "d4" });
  });

  it("drops dice below d4 instead of going lower", () => {
    assert.deepEqual(applyArmorDieReduction(2, "d4", 3), { dieCount: 0, dieType: "d4" });
  });

  it("never returns a negative die count for extreme armor levels", () => {
    assert.equal(applyArmorDieReduction(1, "d4", 10).dieCount, 0);
  });

  it("throws on an unknown die type", () => {
    assert.throws(() => applyArmorDieReduction(1, "d3", 1), RangeError);
  });
});

describe("applyLightArmorFlat (dlc p.136)", () => {
  it("subtracts the flat value from the total (worked example, dlc p.136)", () => {
    assert.equal(applyLightArmorFlat(14, 4), 10);
  });

  it("floors at 0, never negative", () => {
    assert.equal(applyLightArmorFlat(2, 4), 0);
  });

  it("returns the total unchanged when lightArmorValue is 0", () => {
    assert.equal(applyLightArmorFlat(10, 0), 10);
  });
});
