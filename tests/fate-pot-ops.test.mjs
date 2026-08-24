/**
 * Unit tests for applyFatePotOp — the pure GM-side applier for the Fate Pot
 * wire protocol (module/core/chips/fate-pot.mjs). The GM query handler and
 * these tests share the exact same function, so what passes here is what a
 * remote client's op does to the pot.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyFatePotOp,
  assertFatePotOpAuthorized,
  drawBlindPure,
} from "../module/core/chips/fate-pot.mjs";
import { CHIP_LIMIT, FATE_POT_SEED } from "../module/core/config.mjs";

/** Fresh fixture pot for every test. */
const pot = () => ({ white: 5, red: 3, blue: 2, legend: 1 });

describe("applyFatePotOp", () => {
  describe("patch", () => {
    it("overwrites the given colors and keeps the rest", () => {
      const { pot: next } = applyFatePotOp(pot(), { op: "patch", patch: { white: 10 } });
      assert.deepEqual(next, { white: 10, red: 3, blue: 2, legend: 1 });
    });

    it("clamps negative values to zero", () => {
      const { pot: next } = applyFatePotOp(pot(), { op: "patch", patch: { red: -4 } });
      assert.equal(next.red, 0);
    });

    it("throws on an unknown color key", () => {
      assert.throws(() => applyFatePotOp(pot(), { op: "patch", patch: { gold: 1 } }), /color/);
    });

    it("throws on a non-integer value", () => {
      assert.throws(() => applyFatePotOp(pot(), { op: "patch", patch: { white: 1.5 } }), /integer/);
    });
  });

  describe("drawBlind", () => {
    it("matches drawBlindPure given the same rng", () => {
      // Arrange — deterministic rng always picks the first pool entry.
      const rng = () => 0;
      // Act
      const viaOp = applyFatePotOp(pot(), { op: "drawBlind", n: 3 }, rng);
      const direct = drawBlindPure(pot(), 3, rng);
      // Assert
      assert.deepEqual(viaOp.drawn, direct.drawn);
      assert.deepEqual(viaOp.pot, direct.remaining);
    });

    it("throws on a non-positive or non-integer count", () => {
      assert.throws(() => applyFatePotOp(pot(), { op: "drawBlind", n: 0 }), /positive integer/);
      assert.throws(() => applyFatePotOp(pot(), { op: "drawBlind", n: 1.5 }), /positive integer/);
    });
  });

  describe("returnToPool", () => {
    it("adds n chips of the given color", () => {
      const { pot: next } = applyFatePotOp(pot(), { op: "returnToPool", color: "white", n: 2 });
      assert.equal(next.white, 7);
    });

    it("throws on an unknown color", () => {
      assert.throws(
        () => applyFatePotOp(pot(), { op: "returnToPool", color: "gold", n: 1 }),
        /color/
      );
    });
  });

  describe("returnBatch", () => {
    it("atomically adds a mixed batch", () => {
      const { pot: next } = applyFatePotOp(pot(), {
        op: "returnBatch",
        colors: ["white", "red", "white", "legend"],
      });
      assert.deepEqual(next, { white: 7, red: 4, blue: 2, legend: 2 });
    });

    it("rejects an empty batch and unknown colors", () => {
      assert.throws(() => applyFatePotOp(pot(), { op: "returnBatch", colors: [] }), /non-empty/);
      assert.throws(() => applyFatePotOp(pot(), { op: "returnBatch", colors: ["gold"] }), /color/);
    });
  });

  describe("discard", () => {
    it("removes n chips, flooring at zero", () => {
      const { pot: next } = applyFatePotOp(pot(), { op: "discard", color: "legend", n: 5 });
      assert.equal(next.legend, 0);
    });
  });

  describe("spendWithTithe", () => {
    it("returns the spent chip and draws nothing when tithe is false", () => {
      const { pot: next, drawn } = applyFatePotOp(pot(), {
        op: "spendWithTithe",
        color: "red",
        tithe: false,
      });
      assert.equal(next.red, 4); // 3 + 1 returned
      assert.equal(drawn, undefined);
    });

    it("returns the chip and draws one Tithe chip in a single transform", () => {
      const rng = () => 0; // deterministic — picks the first pool entry (white)
      const { pot: next, drawn } = applyFatePotOp(
        pot(),
        { op: "spendWithTithe", color: "red", tithe: true },
        rng
      );
      assert.equal(next.red, 4); // spent red returned
      assert.equal(next.white, 4); // one white drawn as the Tithe
      assert.deepEqual(drawn, ["white"]);
    });

    it("throws on an unknown color", () => {
      assert.throws(() => applyFatePotOp(pot(), { op: "spendWithTithe", color: "gold" }), /color/);
    });
  });

  describe("reset", () => {
    it("returns the starting seed", () => {
      const { pot: next } = applyFatePotOp(pot(), { op: "reset" });
      assert.deepEqual(next, FATE_POT_SEED);
    });
  });

  it("throws on an unknown op", () => {
    assert.throws(() => applyFatePotOp(pot(), { op: "steal" }), /Unknown Fate Pot op/);
    assert.throws(() => applyFatePotOp(pot(), undefined), /Unknown Fate Pot op/);
  });

  it("does not mutate the input pot", () => {
    const input = pot();
    applyFatePotOp(input, { op: "returnToPool", color: "white", n: 2 });
    assert.deepEqual(input, pot());
  });

  it("results survive a JSON round trip unchanged (wire contract)", () => {
    const result = applyFatePotOp(pot(), { op: "drawBlind", n: 2 }, () => 0);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  });
});

describe("assertFatePotOpAuthorized", () => {
  const asPlayer = { isGM: false };
  const asGM = { isGM: true };

  it("blocks a non-GM from reset and patch", () => {
    assert.throws(() => assertFatePotOpAuthorized({ op: "reset" }, asPlayer), /Only a GM/);
    assert.throws(
      () => assertFatePotOpAuthorized({ op: "patch", patch: {} }, asPlayer),
      /Only a GM/
    );
  });

  it("allows a GM to reset and patch", () => {
    assert.doesNotThrow(() => assertFatePotOpAuthorized({ op: "reset" }, asGM));
    assert.doesNotThrow(() => assertFatePotOpAuthorized({ op: "patch", patch: {} }, asGM));
  });

  it("lets a player draw one chip (Tithe/Joker) but not a bulk draw", () => {
    assert.doesNotThrow(() => assertFatePotOpAuthorized({ op: "drawBlind", n: 1 }, asPlayer));
    assert.throws(
      () => assertFatePotOpAuthorized({ op: "drawBlind", n: 2 }, asPlayer),
      /Only a GM/
    );
  });

  it("lets a GM draw in bulk", () => {
    assert.doesNotThrow(() => assertFatePotOpAuthorized({ op: "drawBlind", n: 50 }, asGM));
  });

  it("allows a player's own spendWithTithe", () => {
    assert.doesNotThrow(() =>
      assertFatePotOpAuthorized({ op: "spendWithTithe", color: "red", tithe: true }, asPlayer)
    );
  });

  it("caps a player's returnToPool/discard at the chip limit", () => {
    assert.doesNotThrow(() =>
      assertFatePotOpAuthorized({ op: "returnToPool", color: "white", n: CHIP_LIMIT }, asPlayer)
    );
    assert.throws(
      () =>
        assertFatePotOpAuthorized({ op: "discard", color: "white", n: CHIP_LIMIT + 1 }, asPlayer),
      /per-request limit/
    );
    assert.doesNotThrow(() =>
      assertFatePotOpAuthorized(
        { op: "returnBatch", colors: Array(CHIP_LIMIT).fill("white") },
        asPlayer
      )
    );
    assert.throws(
      () =>
        assertFatePotOpAuthorized(
          { op: "returnBatch", colors: Array(CHIP_LIMIT + 1).fill("white") },
          asPlayer
        ),
      /per-request limit/
    );
  });
});
