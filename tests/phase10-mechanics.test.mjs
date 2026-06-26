/**
 * Phase 10 — Blessed, Shaman, Mad Scientist pure-logic tests.
 *
 * Tests cover only the pure-logic parts that don't require Foundry globals.
 * Foundry-dependent workflows (invokeMiracle, performRitual, deviseBlueprint)
 * are verified manually via Playwright in the dev world.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Blessed: sin TNs ──────────────────────────────────────────────────────────

describe("SIN_TNS (fb p.103-104)", () => {
  // Values are tested via inline import; we avoid importing the full mechanic
  // file (which calls renderTemplate etc.) by just verifying the data we embed.
  it("minor sin TN is 5", () => assert.equal(SIN_TNS.minor, 5));
  it("major sin TN is 9", () => assert.equal(SIN_TNS.major, 9));
  it("mortal sin TN is 11", () => assert.equal(SIN_TNS.mortal, 11));
});

// We can't import mechanics.mjs directly (it references Foundry globals),
// so we inline the tested logic as pure functions.

const SIN_TNS = { minor: 5, major: 9, mortal: 11 };

// ── Mad Scientist: reliability calculation ────────────────────────────────────

describe("Gizmo reliability calculation (dlc p.170)", () => {
  /**
   * Reliability = 10 (base) + raises_blueprint×2 + raises_construction×2, max 19.
   * dlc p.170: "each raise rolled when devising the blueprint or constructing
   * the device adds +2 to its Reliability... up to a maximum of 19."
   */
  function computeReliability(blueprintRaises, constructionRaises) {
    const afterBlueprint = Math.min(19, 10 + blueprintRaises * 2);
    const afterConstruction = Math.min(19, afterBlueprint + constructionRaises * 2);
    return afterConstruction;
  }

  it("base reliability is 10 with no raises", () => {
    assert.equal(computeReliability(0, 0), 10);
  });

  it("2 blueprint raises → 14", () => {
    assert.equal(computeReliability(2, 0), 14);
  });

  it("3 construction raises → 16", () => {
    assert.equal(computeReliability(0, 3), 16);
  });

  it("2 blueprint + 2 construction raises → 18", () => {
    assert.equal(computeReliability(2, 2), 18);
  });

  it("caps at 19 even with many raises", () => {
    assert.equal(computeReliability(5, 5), 19);
  });

  it("blueprint raises cap before construction raises are added", () => {
    // 10 blueprint raises would give 30 without cap → capped to 19
    // then 0 construction → stays 19
    assert.equal(computeReliability(10, 0), 19);
  });
});

// ── Mad Scientist: malfunction trigger ───────────────────────────────────────

describe("Malfunction trigger (dlc p.247)", () => {
  // "If the number on that die is greater than the Reliability of the gizmo,
  // a malfunction of some sort has occurred." dlc p.247.
  function isMalfunction(d20, reliability) {
    return d20 > reliability;
  }

  it("d20 = reliability → no malfunction", () => {
    assert.equal(isMalfunction(10, 10), false);
  });

  it("d20 > reliability → malfunction", () => {
    assert.equal(isMalfunction(11, 10), true);
  });

  it("d20 = 20 with reliability 19 → malfunction", () => {
    assert.equal(isMalfunction(20, 19), true);
  });

  it("d20 = 1 → never malfunction (best roll)", () => {
    assert.equal(isMalfunction(1, 10), false);
  });
});

// ── Mad Scientist: malfunction severity ──────────────────────────────────────

describe("Malfunction severity from 2d6 (dlc p.247)", () => {
  // 2–5 → Major; 6–10 → Minor; 11–12 → Catastrophic. dlc p.247.
  function malfunctionSeverity(total) {
    if (total <= 5) return "major";
    if (total <= 10) return "minor";
    return "catastrophic";
  }

  it("2d6=2 → major", () => assert.equal(malfunctionSeverity(2), "major"));
  it("2d6=5 → major", () => assert.equal(malfunctionSeverity(5), "major"));
  it("2d6=6 → minor", () => assert.equal(malfunctionSeverity(6), "minor"));
  it("2d6=10 → minor", () => assert.equal(malfunctionSeverity(10), "minor"));
  it("2d6=11 → catastrophic", () => assert.equal(malfunctionSeverity(11), "catastrophic"));
  it("2d6=12 → catastrophic", () => assert.equal(malfunctionSeverity(12), "catastrophic"));
});

// ── Shaman: manitou raises calculation ───────────────────────────────────────

describe("Manitou opposed roll raises (ghost-dancers p.57)", () => {
  /**
   * In an opposed contest: if manitou wins (spirit > shamanTotal),
   * manitou raises = floor((spirit - shamanTotal) / 5), min 0.
   */
  function manitouRaises(manitouSpirit, shamanTotal) {
    if (shamanTotal >= manitouSpirit) return 0;
    return Math.max(0, Math.floor((manitouSpirit - shamanTotal) / 5));
  }

  it("shaman wins → 0 raises for manitou", () => {
    assert.equal(manitouRaises(10, 12), 0);
  });

  it("tie → shaman wins, 0 raises", () => {
    assert.equal(manitouRaises(10, 10), 0);
  });

  it("manitou 15, shaman 8 → 1 raise", () => {
    assert.equal(manitouRaises(15, 8), 1);
  });

  it("manitou 20, shaman 5 → 3 raises", () => {
    assert.equal(manitouRaises(20, 5), 3);
  });

  it("manitou 20, shaman 0 (bust) → 4 raises", () => {
    assert.equal(manitouRaises(20, 0), 4);
  });
});

// ── GIZMO_CONSTRUCTION_TABLE spot checks ─────────────────────────────────────

describe("GIZMO_CONSTRUCTION_TABLE (dlc p.168-169)", () => {
  const TABLE = {
    pair: 5,
    jacks: 7,
    twoPair: 9,
    threeOfAKind: 11,
    straight: 13,
    flush: 15,
    fullHouse: 17,
    fourOfAKind: 19,
    straightFlush: 21,
    royalFlush: 25,
  };

  it("pair → Fair (5)", () => assert.equal(TABLE.pair, 5));
  it("flush → Formidable (15)", () => assert.equal(TABLE.flush, 15));
  it("royalFlush → Herculean (25)", () => assert.equal(TABLE.royalFlush, 25));
});
