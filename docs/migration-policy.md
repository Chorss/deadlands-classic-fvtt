# World Data Migration Policy

This document describes how schema changes are applied to existing Foundry worlds
when the system version is updated. It targets contributors extending the system
and GMs upgrading from older versions.

## Versioning

Schema changes follow Semantic Versioning (see `docs/architecture.md §Versioning`):

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

In the `ready` hook a migration guard reads this value and runs any pending migrations:

```js
Hooks.once("ready", () => {
  const worldVersion = game.settings.get(SYSTEM_ID, "migrationVersion");
  if (worldVersion === "") {
    // Fresh world — nothing to migrate.
    game.settings.set(SYSTEM_ID, "migrationVersion", game.system.version);
    return;
  }
  migrateWorld(worldVersion, game.system.version);
});
```

## Writing a migration

1. Add a function `migrateV0_1_to_V0_2(actor)` (pure — takes old document data, returns new).
2. Register it in the migration table with the version range it covers.
3. Add a `node:test` unit test in `tests/migration.test.mjs` covering the transform.
4. Update the migration version sentinel after a successful pass.

**Migration functions must be pure:** they receive plain data objects (from `toObject()`)
and return the updated object. No `actor.update()` inside the function — callers apply
the returned update.

### Migration table shape (future implementation)

```js
// module/core/migration.mjs (to be created when the first breaking change arrives)
const MIGRATIONS = [
  {
    from: "0.1.0",
    to:   "0.2.0",
    migrate: migrateV0_1_to_V0_2,
  },
];
```

## What gets migrated

Each migration pass iterates:

1. `game.actors` — all actor documents.
2. Actors' embedded items — `actor.items`.
3. `game.items` — world-level items (compendium imports).
4. Scene tokens — `scene.tokens.map(t => t.actor)`.

The `ready` hook guard ensures migrations only run once per world.

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
