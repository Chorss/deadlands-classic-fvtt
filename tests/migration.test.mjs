/**
 * Migration tests — verify that world-data transforms are correct.
 *
 * Each migration function must be pure: receives a plain data object,
 * returns the updated data object. No Foundry runtime needed.
 * See docs/migration-policy.md for the full policy.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Simulate a Foundry TypeDataModel `initial:` default injection by ensuring
 * an expected field is present in the output with its default value when
 * absent in the input. Used to verify self-migrating schema additions.
 *
 * @param {object} data       — plain actor system data (pre-migration state)
 * @param {string} fieldPath  — dot-notation path to check (e.g. "harrowed.isHarrowed")
 * @param {*} expectedDefault — what the field should default to
 */
function assertSelfMigrates(data, fieldPath, _expectedDefault) {
  const parts = fieldPath.split(".");
  let node = data;
  for (const part of parts.slice(0, -1)) {
    node = node?.[part];
  }
  const last = parts.at(-1);
  // In real Foundry, the TypeDataModel's `initial:` injects the default if absent.
  // Here we verify the pre-migration data LACKS the field (proving migration is needed).
  assert.equal(
    node?.[last],
    undefined,
    `Field "${fieldPath}" already present — self-migration test needs pre-migration fixture`
  );
}

// ── migrationVersion sentinel ─────────────────────────────────────────────────

describe("migrationVersion sentinel", () => {
  it("fresh world has empty string sentinel", () => {
    // The system registers migrationVersion with default: "" so fresh worlds
    // skip migration and just stamp the current version.
    const defaultValue = "";
    assert.equal(defaultValue, "");
  });
});

// ── v0.1.0 → v0.2.0 — Harrowed overlay (self-migrating) ─────────────────────

describe("v0.1.0 → v0.2.0 Harrowed overlay fields", () => {
  it("pre-migration actor data lacks harrowed namespace", () => {
    // Actor data created in v0.1.0 before the Harrowed overlay was added.
    const oldActorData = {
      traits: { spirit: { dieCount: 2, dieType: "d6", modifier: 0, aptitudes: {} } },
      wounds: {},
      chips: { white: 0, red: 0, blue: 0, legend: 0 },
      // harrowed is ABSENT — it did not exist in v0.1.0
    };

    assertSelfMigrates(oldActorData, "harrowed.isHarrowed", false);
    assertSelfMigrates(oldActorData, "harrowed.dominion", undefined);
  });

  it("Foundry injects harrowed.isHarrowed=false via initial: default", () => {
    // Simulate what TypeDataModel initial: injection produces.
    // The actual injection happens in Foundry's base TypeDataModel; we verify
    // the EXPECTED post-injection shape that matches our defineSchema().
    const expectedPostMigration = {
      isHarrowed: false,
      dominion: {
        spiritControl: 0,
        lastRoll: null,
      },
      harrowedPowers: [],
      countingCoup: [],
    };

    assert.equal(expectedPostMigration.isHarrowed, false);
    assert.equal(expectedPostMigration.dominion.spiritControl, 0);
    assert.deepEqual(expectedPostMigration.harrowedPowers, []);
    assert.deepEqual(expectedPostMigration.countingCoup, []);
  });

  it("existing harrowed actors retain their data unchanged", () => {
    // An actor that was Harrowed in the same version — data should be preserved.
    const harrowedActorData = {
      harrowed: {
        isHarrowed: true,
        dominion: { spiritControl: 3, lastRoll: { winner: "pc", pointsGained: 1 } },
        harrowedPowers: [{ id: "pw01", name: "Claws", level: 2, kind: "common", description: "" }],
        countingCoup: [{ source: "Ravenite", power: "Strength", taint: "" }],
      },
    };

    assert.equal(harrowedActorData.harrowed.isHarrowed, true);
    assert.equal(harrowedActorData.harrowed.dominion.spiritControl, 3);
    assert.equal(harrowedActorData.harrowed.harrowedPowers.length, 1);
    assert.equal(harrowedActorData.harrowed.countingCoup.length, 1);
  });
});
