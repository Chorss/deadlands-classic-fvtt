/**
 * Unit tests for chip-rules pure logic.
 * No Foundry runtime needed — tests canSpend, applyChipCap, drawBlindPure.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyChipCap, canSpend } from "../module/core/chips/chip-rules.mjs";
import { grantChips } from "../module/core/chips/chip-widget.mjs";
import { drawBlindPure, FatePot } from "../module/core/chips/fate-pot.mjs";

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

  it("blocks white once a red/blue/legend chip has been spent (No Going Back, dlc p.148)", () => {
    const r = canSpend("white", { available: 5, higherAlreadySpent: true });
    assert.equal(r.can, false);
    assert.equal(r.reason, "DEADLANDS.ChipRule.NoGoingBack");
  });

  it("blocks unknown color", () => {
    const r = canSpend("purple", { available: 1 });
    assert.equal(r.can, false);
  });
});

describe("applyChipCap", () => {
  it("keeps chips when under cap", () => {
    const chips = { white: 2, red: 1, blue: 0, legend: 0 };
    const { kept, converted, bpGained } = applyChipCap(chips, ["white", "red"]);
    assert.deepEqual(kept, ["white", "red"]);
    assert.deepEqual(converted, []);
    assert.equal(bpGained, 0);
  });

  it("converts surplus to BP at correct rates", () => {
    // Actor at cap (10 chips) receives white + blue → both convert
    const chips = { white: 4, red: 3, blue: 2, legend: 1 }; // total = 10
    const { kept, converted, bpGained } = applyChipCap(chips, ["white", "blue", "legend"]);
    assert.deepEqual(kept, []);
    assert.deepEqual(converted, ["white", "blue", "legend"]);
    // white = 1 BP, blue = 3 BP, legend = 5 BP → 9 total
    assert.equal(bpGained, 1 + 3 + 5);
  });

  it("fills up to cap then converts remainder", () => {
    const chips = { white: 9, red: 0, blue: 0, legend: 0 }; // total = 9
    const { kept, converted, bpGained } = applyChipCap(chips, ["white", "red", "blue"]);
    // 1 slot left → keep first chip (white), convert red (2 BP) and blue (3 BP)
    assert.deepEqual(kept, ["white"]);
    assert.deepEqual(converted, ["red", "blue"]);
    assert.equal(bpGained, 2 + 3);
  });

  it("uses White 1, Red 2, Blue 3, and Legend 5 BP values", () => {
    const chips = { white: 10, red: 0, blue: 0, legend: 0 };
    const result = applyChipCap(chips, ["white", "red", "blue", "legend"]);
    assert.deepEqual(result.converted, ["white", "red", "blue", "legend"]);
    assert.equal(result.bpGained, 1 + 2 + 3 + 5);
  });
});

describe("grantChips", () => {
  function fakeActor(chips, bounty = 0, updateImpl) {
    const actor = {
      system: { chips: { ...chips }, bounty },
      updates: [],
      async update(update) {
        actor.updates.push(update);
        if (updateImpl) {
          return updateImpl(update);
        }
        for (const [path, value] of Object.entries(update)) {
          if (path === "system.bounty") {
            actor.system.bounty = value;
          } else {
            actor.system.chips[path.split(".").at(-1)] = value;
          }
        }
      },
    };
    return actor;
  }

  it("keeps two of three pot-backed chips at a total of eight and returns the third", async () => {
    const actor = fakeActor({ white: 8, red: 0, blue: 0, legend: 0 });
    const returned = [];
    const original = FatePot.returnBatch;
    FatePot.returnBatch = async (colors) => returned.push(...colors);
    try {
      const result = await grantChips(actor, ["white", "red", "blue"], { source: "pot" });
      assert.deepEqual(result, { kept: ["white", "red"], converted: ["blue"], bpGained: 3 });
      assert.equal(actor.system.chips.white, 9);
      assert.equal(actor.system.chips.red, 1);
      assert.equal(actor.system.bounty, 3);
      assert.deepEqual(returned, ["blue"]);
    } finally {
      FatePot.returnBatch = original;
    }
  });

  it("converts every chip at the cap and returns the whole pot-backed batch", async () => {
    const actor = fakeActor({ white: 10, red: 0, blue: 0, legend: 0 });
    const returned = [];
    const original = FatePot.returnBatch;
    FatePot.returnBatch = async (colors) => returned.push(...colors);
    try {
      const result = await grantChips(actor, ["white", "red", "legend"], { source: "pot" });
      assert.deepEqual(result.converted, ["white", "red", "legend"]);
      assert.equal(result.bpGained, 8);
      assert.equal(actor.system.bounty, 8);
      assert.deepEqual(returned, ["white", "red", "legend"]);
    } finally {
      FatePot.returnBatch = original;
    }
  });

  it("does not return converted external grants to the Fate Pot", async () => {
    const actor = fakeActor({ white: 10, red: 0, blue: 0, legend: 0 });
    let returnCalls = 0;
    const original = FatePot.returnBatch;
    FatePot.returnBatch = async () => returnCalls++;
    try {
      const result = await grantChips(actor, ["legend"], { source: "external" });
      assert.deepEqual(result, { kept: [], converted: ["legend"], bpGained: 5 });
      assert.equal(returnCalls, 0);
    } finally {
      FatePot.returnBatch = original;
    }
  });

  it("returns every drawn color and rethrows when the actor update fails", async () => {
    const actor = fakeActor({ white: 8, red: 0, blue: 0, legend: 0 }, 0, async () => {
      throw new Error("actor update failed");
    });
    const returned = [];
    const original = FatePot.returnBatch;
    FatePot.returnBatch = async (colors) => returned.push(...colors);
    try {
      await assert.rejects(
        grantChips(actor, ["white", "red", "blue"], { source: "pot" }),
        /actor update failed/
      );
      assert.deepEqual(returned, ["white", "red", "blue"]);
    } finally {
      FatePot.returnBatch = original;
    }
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
