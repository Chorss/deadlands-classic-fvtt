/**
 * Unit tests for guts-check pure helpers.
 *
 * rollGutsCheck (Foundry-integrated) is tested manually in Foundry.
 *
 * @license MIT
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lookupScart, scartDiceForTN } from "../module/core/dice/guts-check.mjs";

// ── scartDiceForTN ────────────────────────────────────────────────────────────

describe("scartDiceForTN (dlc p.221)", () => {
  it("maps TN 3 → 1d6", () => assert.equal(scartDiceForTN(3), 1));
  it("maps TN 5 → 2d6", () => assert.equal(scartDiceForTN(5), 2));
  it("maps TN 7 → 3d6", () => assert.equal(scartDiceForTN(7), 3));
  it("maps TN 9 → 4d6", () => assert.equal(scartDiceForTN(9), 4));
  it("maps TN 11 → 5d6", () => assert.equal(scartDiceForTN(11), 5));
  it("maps TN 13 → 6d6", () => assert.equal(scartDiceForTN(13), 6));

  it("falls back to nearest lower row for non-table TN", () => {
    // TN 4 is between 3 and 5 — nearest lower is 3 → 1d6
    assert.equal(scartDiceForTN(4), 1);
    // TN 10 is between 9 and 11 → 4d6
    assert.equal(scartDiceForTN(10), 4);
  });

  it("uses max row (13→6d6) for TNs above 13", () => {
    assert.equal(scartDiceForTN(15), 6);
  });
});

// ── lookupScart ───────────────────────────────────────────────────────────────

describe("lookupScart (dlc p.222)", () => {
  const cases = [
    { total: 1, key: "uneasy", windDice: 0 },
    { total: 3, key: "uneasy", windDice: 0 },
    { total: 4, key: "queasy", windDice: 0 },
    { total: 6, key: "queasy", windDice: 0 },
    { total: 7, key: "willies", windDice: 1 },
    { total: 9, key: "willies", windDice: 1 },
    { total: 10, key: "heebieJeebies", windDice: 1 },
    { total: 12, key: "heebieJeebies", windDice: 1 },
    { total: 13, key: "weakKnees", windDice: 1 },
    { total: 15, key: "weakKnees", windDice: 1 },
    { total: 16, key: "deadFaint", windDice: 3 },
    { total: 18, key: "deadFaint", windDice: 3 },
    { total: 19, key: "minorPhobia", windDice: 1 },
    { total: 21, key: "minorPhobia", windDice: 1 },
    { total: 22, key: "majorPhobia", windDice: 1 },
    { total: 24, key: "majorPhobia", windDice: 1 },
    { total: 25, key: "corporealAlteration", windDice: 1 },
    { total: 27, key: "corporealAlteration", windDice: 1 },
    { total: 28, key: "theShakes", windDice: 1 },
    { total: 30, key: "theShakes", windDice: 1 },
    { total: 31, key: "heartAttack", windDice: 3 },
    { total: 35, key: "heartAttack", windDice: 3 },
    { total: 36, key: "corporealAging", windDice: 3 },
    { total: 99, key: "corporealAging", windDice: 3 },
  ];

  for (const { total, key, windDice } of cases) {
    it(`total ${total} → "${key}" (windDice=${windDice})`, () => {
      const result = lookupScart(total);
      assert.ok(result, `no entry found for total ${total}`);
      assert.equal(result.key, key);
      assert.equal(result.windDice, windDice);
    });
  }

  it("returns null for total 0", () => {
    assert.equal(lookupScart(0), null);
  });
});
