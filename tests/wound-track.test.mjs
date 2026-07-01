/**
 * Unit tests for wound-track pure helpers and hit-location/wind-calculator utilities.
 *
 * Foundry-integrated functions (applyWounds, tickBleeding, recoverWind) are
 * tested manually in Foundry — they require a live actor document.
 *
 * @license MIT
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Stub the Foundry dependency so the module can load in node:test.
globalThis.foundry = undefined;

import { drawHitLocation, resolveHitLocation } from "../module/core/wounds/hit-location.mjs";
import {
  computeWindMax,
  gutsWoundsFromNegativeWind,
  isWinded,
} from "../module/core/wounds/wind-calculator.mjs";
import {
  accumulateWounds,
  getBleedingRate,
  gutsTotal,
  highestWoundPenalty,
  totalBleedingRate,
  windDiceCount,
  woundsFromDamage,
} from "../module/core/wounds/wound-track.mjs";

// ── woundsFromDamage ─────────────────────────────────────────────────────────

describe("woundsFromDamage", () => {
  it("returns floor(damage/size)", () => {
    assert.equal(woundsFromDamage(12, 6), 2);
    assert.equal(woundsFromDamage(6, 6), 1);
    assert.equal(woundsFromDamage(11, 6), 1);
    assert.equal(woundsFromDamage(5, 6), 0); // below size — 0 wounds
  });

  it("defaults size to 6", () => {
    assert.equal(woundsFromDamage(12), 2);
  });

  it("returns 0 for zero or negative damage", () => {
    assert.equal(woundsFromDamage(0, 6), 0);
    assert.equal(woundsFromDamage(-3, 6), 0);
  });
});

// ── accumulateWounds ─────────────────────────────────────────────────────────

describe("accumulateWounds", () => {
  it("adds wounds to current severity", () => {
    assert.equal(accumulateWounds(1, 2), 3);
  });

  it("caps at 5 (WOUND_MAX)", () => {
    assert.equal(accumulateWounds(4, 3), 5);
    assert.equal(accumulateWounds(5, 99), 5);
  });

  it("stays at 0 when adding 0", () => {
    assert.equal(accumulateWounds(0, 0), 0);
  });
});

// ── windDiceCount ─────────────────────────────────────────────────────────────

describe("windDiceCount", () => {
  it("returns 1 minimum even with 0 wounds (dlc p.141)", () => {
    assert.equal(windDiceCount(0), 1);
  });

  it("returns wound count for positive wounds", () => {
    assert.equal(windDiceCount(1), 1);
    assert.equal(windDiceCount(3), 3);
  });
});

// ── getBleedingRate ───────────────────────────────────────────────────────────

describe("getBleedingRate (dlc p.142)", () => {
  it("returns 0 for none/light/heavy (0-2)", () => {
    assert.equal(getBleedingRate(0), 0);
    assert.equal(getBleedingRate(1), 0);
    assert.equal(getBleedingRate(2), 0);
  });

  it("returns -1 for Serious (3)", () => {
    assert.equal(getBleedingRate(3), 1);
  });

  it("returns -2 for Critical (4)", () => {
    assert.equal(getBleedingRate(4), 2);
  });

  it("returns -3 for Maimed limb (5 + isLimb)", () => {
    assert.equal(getBleedingRate(5, true), 3);
  });

  it("returns -2 for Critical non-limb location at severity 5", () => {
    // Noggin/guts at severity 5 = Critical-level bleed (no limb bonus)
    assert.equal(getBleedingRate(5, false), 2);
  });
});

// ── gutsTotal (dlc p.139) ─────────────────────────────────────────────────────

describe("gutsTotal (dlc p.139)", () => {
  it("sums gizzards/upperGuts/lowerGuts into one pool", () => {
    const wounds = {
      upperGuts: { severity: 2 },
      lowerGuts: { severity: 1 },
      gizzards: { severity: 0 },
    };
    assert.equal(gutsTotal(wounds), 3);
  });

  it("caps the pooled total at WOUND_MAX (5)", () => {
    const wounds = {
      upperGuts: { severity: 4 },
      lowerGuts: { severity: 4 },
      gizzards: { severity: 0 },
    };
    assert.equal(gutsTotal(wounds), 5);
  });

  it("ignores non-guts locations", () => {
    const wounds = { noggin: { severity: 5 }, upperGuts: { severity: 1 } };
    assert.equal(gutsTotal(wounds), 1);
  });
});

// ── highestWoundPenalty ───────────────────────────────────────────────────────

describe("highestWoundPenalty", () => {
  it("returns penalty for highest severity across locations", () => {
    const wounds = {
      noggin: { severity: 0 },
      upperGuts: { severity: 2 },
      leftArm: { severity: 3 },
    };
    assert.equal(highestWoundPenalty(wounds), -3);
  });

  it("returns 0 when no wounds", () => {
    const wounds = {
      noggin: { severity: 0 },
      leftLeg: { severity: 0 },
    };
    assert.equal(highestWoundPenalty(wounds), 0);
  });

  it("pools guts sub-locations instead of treating them independently (dlc p.139)", () => {
    // 4 lowerGuts + 4 upperGuts would each individually stay under Maimed (5),
    // but the shared pool caps at 5 and must drive the penalty as Maimed.
    const wounds = {
      noggin: { severity: 0 },
      lowerGuts: { severity: 4 },
      upperGuts: { severity: 4 },
      gizzards: { severity: 0 },
    };
    assert.equal(highestWoundPenalty(wounds), highestWoundPenalty({ noggin: { severity: 5 } }));
  });
});

// ── totalBleedingRate (dlc p.142) ───────────────────────────────────────────────

describe("totalBleedingRate (dlc p.142)", () => {
  it("sums independent bleed rates for non-guts locations", () => {
    const wounds = {
      leftArm: { severity: 3 }, // Serious → 1
      noggin: { severity: 4 }, // Critical → 2
    };
    assert.equal(totalBleedingRate(wounds), 3);
  });

  it("counts the guts pool once instead of per sub-location", () => {
    // 4 lowerGuts + 4 upperGuts pool to 5 (Maimed cap, dlc p.139) — bleeding
    // must charge that ONE pooled severity once, not 2-3x per sub-location.
    const wounds = {
      lowerGuts: { severity: 4 },
      upperGuts: { severity: 4 },
      gizzards: { severity: 0 },
    };
    assert.equal(totalBleedingRate(wounds), getBleedingRate(5, false));
  });

  it("returns 0 when nothing bleeds", () => {
    const wounds = { noggin: { severity: 1 }, upperGuts: { severity: 0 } };
    assert.equal(totalBleedingRate(wounds), 0);
  });
});

// ── resolveHitLocation ────────────────────────────────────────────────────────

describe("resolveHitLocation (dlc p.133)", () => {
  it("maps 20 to noggin", () => {
    assert.equal(resolveHitLocation(20, 1), "noggin");
  });

  it("maps 15-19 to upperGuts", () => {
    assert.equal(resolveHitLocation(15, 1), "upperGuts");
    assert.equal(resolveHitLocation(19, 1), "upperGuts");
  });

  it("maps 10 to gizzards", () => {
    assert.equal(resolveHitLocation(10, 1), "gizzards");
  });

  it("resolves arms by side (11-14)", () => {
    // even side → right, odd → left
    assert.equal(resolveHitLocation(11, 2), "rightArm");
    assert.equal(resolveHitLocation(11, 1), "leftArm");
  });

  it("resolves legs by side (1-4)", () => {
    assert.equal(resolveHitLocation(3, 4), "rightLeg");
    assert.equal(resolveHitLocation(3, 3), "leftLeg");
  });

  it("raise offset shifts result", () => {
    // 19 + 1 raise → 20 (noggin)
    assert.equal(resolveHitLocation(19, 1, 1), "noggin");
  });

  it("clamps at 1 and 20", () => {
    assert.equal(resolveHitLocation(1, 1, -5), resolveHitLocation(1, 1));
    assert.equal(resolveHitLocation(20, 1, 5), "noggin");
  });
});

describe("drawHitLocation", () => {
  it("returns a valid location key with deterministic RNG", () => {
    const valid = [
      "noggin",
      "upperGuts",
      "lowerGuts",
      "gizzards",
      "leftArm",
      "rightArm",
      "leftLeg",
      "rightLeg",
    ];
    // d20=20, sideD=2 → noggin (side irrelevant)
    let call = 0;
    const rng = () => [19 / 20, 1 / 6][call++]; // 20*rng→20, side ignored
    const loc = drawHitLocation({ _rng: rng });
    assert.ok(valid.includes(loc), `unexpected location: ${loc}`);
  });
});

// ── computeWindMax ────────────────────────────────────────────────────────────

describe("computeWindMax (dlc p.40)", () => {
  it("sums Vigor and Spirit die faces", () => {
    const traits = { vigor: { dieType: "d8" }, spirit: { dieType: "d6" } };
    assert.equal(computeWindMax(traits), 14); // 8+6
  });

  it("defaults to d6 for missing traits", () => {
    assert.equal(computeWindMax({}), 12); // 6+6
  });
});

// ── isWinded ─────────────────────────────────────────────────────────────────

describe("isWinded (dlc p.141)", () => {
  it("true when Wind ≤ 0", () => {
    assert.ok(isWinded(0));
    assert.ok(isWinded(-5));
  });

  it("false when Wind > 0", () => {
    assert.ok(!isWinded(1));
  });
});

// ── gutsWoundsFromNegativeWind ────────────────────────────────────────────────

describe("gutsWoundsFromNegativeWind (dlc p.141-142)", () => {
  it("returns 0 when wind is non-negative", () => {
    assert.equal(gutsWoundsFromNegativeWind(5, 12), 0);
    assert.equal(gutsWoundsFromNegativeWind(0, 12), 0);
  });

  it("returns 1 when wind drops past one full windMax interval", () => {
    // windMax = 12, windValue = -13 → floor(13/12) = 1
    assert.equal(gutsWoundsFromNegativeWind(-13, 12), 1);
  });

  it("returns 2 at two full intervals", () => {
    assert.equal(gutsWoundsFromNegativeWind(-24, 12), 2);
  });
});
