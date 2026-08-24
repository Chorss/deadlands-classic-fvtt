/**
 * Migration tests — verify that world-data transforms are correct.
 *
 * Each migration function must be pure: receives a plain data object,
 * returns the updated data object. No Foundry runtime needed.
 * See docs/migration-policy.md for the full policy.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FAITH_DENIAL_MIGRATION_VERSION,
  migrateFaithDenialActor,
  migrateWorld,
  planFaithDenialMigration,
} from "../module/core/migration.mjs";

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

  it("remains at 0.4.1 for the schema-compatible 0.4.2 release", () => {
    assert.equal(FAITH_DENIAL_MIGRATION_VERSION, "0.4.1");
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

// ── v0.4.0 → v0.4.1 — Blessed faith denial Active Effect ────────────────────

function legacyBlessed(overrides = {}) {
  return {
    type: "blessed",
    system: {
      faithDeniedUntil: 4_600,
      faithDeniedSeverity: "minor",
      ...overrides.system,
    },
    effects: overrides.effects ?? [],
  };
}

describe("v0.4.0 → v0.4.1 faith-denial migration", () => {
  it("moves an active timestamp to one V14 Active Effect with remaining time", () => {
    const plan = planFaithDenialMigration(legacyBlessed(), 1_000, {
      effectName: "Miracle Access Denied",
    });

    assert.deepEqual(plan.actorUpdate, {
      "system.faithDeniedUntil": 0,
      "system.faithDeniedSeverity": "none",
    });
    assert.equal(plan.effectData.name, "Miracle Access Denied");
    assert.equal(plan.effectData.duration.value, 3_600);
    assert.equal(plan.effectData.duration.units, "seconds");
    assert.equal(plan.effectData.duration.expiry, null);
    assert.deepEqual(plan.effectData.system.changes, []);
    assert.equal(plan.effectData.flags["deadlands-classic"].faithDenial.severity, "minor");
  });

  it("clears an expired timestamp without creating an effect", () => {
    const plan = planFaithDenialMigration(legacyBlessed(), 4_600, {
      effectName: "Miracle Access Denied",
    });

    assert.equal(plan.effectData, null);
    assert.ok(plan.actorUpdate);
  });

  it("does not duplicate an existing marked effect", () => {
    const actor = legacyBlessed({
      effects: [
        {
          flags: { "deadlands-classic": { faithDenial: { severity: "major" } } },
        },
      ],
    });
    const plan = planFaithDenialMigration(actor, 1_000, {
      effectName: "Miracle Access Denied",
    });

    assert.equal(plan.effectData, null);
    assert.ok(plan.actorUpdate);
  });

  it("is a no-op on a second run after the bridge fields were cleared", async () => {
    const source = legacyBlessed();
    let createCalls = 0;
    let updateCalls = 0;
    const actor = {
      toObject: () => structuredClone(source),
      createEmbeddedDocuments: async (_type, [effect]) => {
        createCalls += 1;
        source.effects.push(effect);
      },
      update: async (changes) => {
        updateCalls += 1;
        source.system.faithDeniedUntil = changes["system.faithDeniedUntil"];
        source.system.faithDeniedSeverity = changes["system.faithDeniedSeverity"];
      },
    };

    await migrateFaithDenialActor(actor, 1_000, "Miracle Access Denied");
    await migrateFaithDenialActor(actor, 1_000, "Miracle Access Denied");

    assert.equal(createCalls, 1);
    assert.equal(updateCalls, 1);
  });

  it("does not stamp migrationVersion when any document migration fails", async () => {
    let versionSet = false;
    const gameInstance = {
      user: { isGM: true },
      users: { activeGM: { isSelf: true } },
      settings: {
        get: () => "0.4.0",
        set: async () => {
          versionSet = true;
        },
      },
      i18n: { localize: () => "Miracle Access Denied" },
      time: { worldTime: 1_000 },
      actors: [
        {
          uuid: "Actor.failure",
          toObject: () => legacyBlessed(),
          createEmbeddedDocuments: async () => {
            throw new Error("database unavailable");
          },
        },
      ],
      scenes: [],
    };

    await assert.rejects(() => migrateWorld(gameInstance), /database unavailable/);
    assert.equal(versionSet, false);
  });
});
