# World Data Migration Policy

This document describes how schema changes are applied to existing Foundry worlds
when the system version is updated. It targets contributors extending the system
and GMs upgrading from older versions.

## Versioning

Schema changes normally follow Semantic Versioning (see `docs/architecture.md §Versioning`).
The maintainer explicitly approved the 0.4.1 faith-denial behavior migration as a patch exception:

- **PATCH** (`0.1.0 → 0.1.1`): bug fixes only, no schema changes.
- **MINOR** (`0.1.0 → 0.2.0`): new optional fields added to existing documents; backward-compatible.
- **MAJOR** (`0.x → 1.0`): breaking schema changes requiring a migration pass.

## Migration version sentinel

On system `init`, the world stores a migration version string:

```js
game.settings.register(SYSTEM_ID, "migrationVersion", {
  scope: "world",
  config: false,
  type: String,
  default: "",
});
```

A real `ready`-hook runner now lives in `module/core/migration.mjs`. It runs only on the
single active GM client, migrates all world and synthetic token Actors, and writes the
sentinel only after every document operation succeeds. A partial failure is therefore
safe to retry on the next launch.

```js
Hooks.once("ready", async () => {
  await migrateWorld(); // internally guarded by game.users.activeGM.isSelf
});
```

## Writing a migration

1. Add a function `migrateV0_1_to_V0_2(actor)` (pure — takes old document data, returns new).
2. Register it in the migration table with the version range it covers.
3. Add a `node:test` unit test covering the transform to `tests/migration.test.mjs` — the file
   already exists and currently holds the sentinel and self-migration cases for the 0.1.0 → 0.2.0
   Harrowed fields; add new cases alongside them rather than creating a second file.
4. Update the migration version sentinel after a successful pass.

**Migration functions must be pure:** they receive plain data objects (from `toObject()`)
and return the updated object. No `actor.update()` inside the function — callers apply
the returned update.

### Migration implementation

```js
const plan = planFaithDenialMigration(actor.toObject(), game.time.worldTime);
if (plan.effectData) await actor.createEmbeddedDocuments("ActiveEffect", [plan.effectData]);
if (plan.actorUpdate) await actor.update(plan.actorUpdate);
```

## What gets migrated

The 0.4.1 faith-denial migration iterates:

1. `game.actors` — all actor documents.
2. Scene-token Actors — `scene.tokens.map(t => t.actor)`, including synthetic Actors.

Future migrations must add any other applicable document collections explicitly; the
runner does not scan unrelated Items for an Actor-only schema change.

The `ready`-hook guard ensures migrations run once per world after full success.

## Backward compatibility promise

Any schema change that would break data stored from a previous version MUST:

1. Ship with a migration function.
2. Bump the MINOR or MAJOR version accordingly.
3. Have a unit test confirming old data → new data is correct.

Fields added with `initial:` values in `defineSchema()` are self-migrating (Foundry
injects defaults on load) and require no explicit migration, but SHOULD still be documented
in `CHANGELOG.md`.

## Current migration state

| System version | Status |
|---|---|
| 0.1.0 | Initial release — no migration needed |
| 0.2.0 | Harrowed overlay fields added (self-migrating via `initial:` defaults) |
| 0.3.0 | Localization audit, accessibility pass, `wind.value` init fix — no schema changes, no migration needed |
| 0.3.1 | Font picker (world setting), CSS layer, `audit-css` tooling — no schema changes, no migration needed |
| 0.3.2 | Formatting/tooling fixes only — no schema changes, no migration needed |
| 0.3.3 | Bug-audit hotfixes (rolls, chips, wounds, concurrency) + internal dedupe — no schema changes, no migration needed |
| 0.3.4 | GM proxy for shared-state writes, rule-fidelity hotfixes, `audit-i18n` tooling — no schema changes, no migration needed |
| 0.4.0 | `weapon` moved off the untyped `{}` stub onto `WeaponDataModel` (`category`, `rangeType`, `damage`, `range`, `shots`, `rof`, `ammoType`, `defense`, `price`, `description`). **Self-migrating**: every field declares an `initial:`, so Foundry fills existing weapon items on load — no migration function needed. Ledger UI redesign, item sheets and the E2E suite touched no other schema. |
| 0.4.1 | First real runner. Active Blessed `faithDeniedUntil` / `faithDeniedSeverity` state moves to one marked, timed Active Effect with the remaining duration. Expired state is only cleared. Existing marked effects prevent duplicates. The legacy schema fields remain as a deprecated bridge until 0.5.0. |
| 0.4.2 | P0 rule corrections change runtime behavior and allow negative values in the existing `wind.value` field, but add no persisted fields or transforms. Existing worlds require no migration; `FAITH_DENIAL_MIGRATION_VERSION` intentionally remains `0.4.1`. |
