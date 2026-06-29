/**
 * Unit tests for chip-rules pure logic.
 * No Foundry runtime needed — tests canSpend, applyChipCap, drawBlindPure.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyChipCap, canSpend } from "../module/core/chips/chip-rules.mjs";
import { drawBlindPure } from "../module/core/chips/fate-pot.mjs";

describe("canSpend", () => {
  it("allows white with no constraints", () => {
    const r = canSpend("white", { available: 3 });
    assert.equal(r.can, true);
  });

  it("blocks when none left", () => {
    const r = canSpend("red", { available: 0 });
    assert.equal(r.can, false);
    assert.equal(r.reason, "DEADLANDS.ChipRule.NoneLeft");
  });

  it("blocks non-legend during bust", () => {
    for (const color of ["white", "red", "blue"]) {
      const r = canSpend(color, { available: 2, isBust: true });
      assert.equal(r.can, false, `${color} should be blocked during bust`);
      assert.equal(r.reason, "DEADLANDS.ChipRule.BustOnlyLegend");
    }
  });

  it("allows legend during bust", () => {
    const r = canSpend("legend", { available: 1, isBust: true });
    assert.equal(r.can, true);
  });

  it("blocks second red/blue/legend when higher already spent", () => {
    for (const color of ["red", "blue", "legend"]) {
      const r = canSpend(color, { available: 2, higherAlreadySpent: true });
      assert.equal(r.can, false, `${color} should be blocked (max 1/action)`);
      assert.equal(r.reason, "DEADLANDS.ChipRule.OnePerAction");
    }
  });

  it("allows white even when higher already spent (unlimited)", () => {
    const r = canSpend("white", { available: 5, higherAlreadySpent: true });
    assert.equal(r.can, true);
  });

  it("blocks unknown color", () => {
    const r = canSpend("purple", { available: 1 });
    assert.equal(r.can, false);
  });
});

describe("applyChipCap", () => {
  it("keeps chips when under cap", () => {
    const chips = { white: 2, red: 1, blue: 0, legend: 0 };
    const { kept, bpGained } = applyChipCap(chips, ["white", "red"]);
    assert.deepEqual(kept, ["white", "red"]);
    assert.equal(bpGained, 0);
  });

  it("converts surplus to BP at correct rates", () => {
    // Actor at cap (10 chips) receives white + blue → both convert
    const chips = { white: 4, red: 3, blue: 2, legend: 1 }; // total = 10
    const { kept, bpGained } = applyChipCap(chips, ["white", "blue", "legend"]);
    assert.deepEqual(kept, []);
    // white = 1 BP, blue = 3 BP, legend = 5 BP → 9 total
    assert.equal(bpGained, 1 + 3 + 5);
  });

  it("fills up to cap then converts remainder", () => {
    const chips = { white: 9, red: 0, blue: 0, legend: 0 }; // total = 9
    const { kept, bpGained } = applyChipCap(chips, ["white", "red", "blue"]);
    // 1 slot left → keep first chip (white), convert red (2 BP) and blue (3 BP)
    assert.deepEqual(kept, ["white"]);
    assert.equal(bpGained, 2 + 3);
  });
});

describe("drawBlindPure", () => {
  it("draws requested number of chips", () => {
    const pot = { white: 10, red: 5, blue: 3, legend: 0 };
    const { drawn, remaining } = drawBlindPure(pot, 3);
    assert.equal(drawn.length, 3);
    const totalBefore = 10 + 5 + 3;
    const totalAfter = Object.values(remaining).reduce((s, n) => s + n, 0);
    assert.equal(totalAfter, totalBefore - 3);
  });

  it("draws at most what is available", () => {
    const pot = { white: 2, red: 0, blue: 0, legend: 0 };
    const { drawn } = drawBlindPure(pot, 5);
    assert.equal(drawn.length, 2);
  });

  it("returns deterministic results with seeded rng", () => {
    const pot = { white: 5, red: 5, blue: 5, legend: 5 };
    // Always pick index 0 → always picks the first color in pool order
    const rng = () => 0;
    const { drawn: first } = drawBlindPure(pot, 3, rng);
    const { drawn: second } = drawBlindPure(pot, 3, rng);
    assert.deepEqual(first, second);
  });

  it("preserves remaining totals correctly", () => {
    const pot = { white: 3, red: 2, blue: 1, legend: 0 };
    const { drawn, remaining } = drawBlindPure(pot, 2);
    for (const color of Object.keys(pot)) {
      const delta = pot[color] - remaining[color];
      assert.equal(delta, drawn.filter((c) => c === color).length);
    }
  });
});
