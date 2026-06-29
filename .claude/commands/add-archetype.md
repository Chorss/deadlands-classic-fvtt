---
description: Scaffold a new archetype — creates manifest.mjs, data.mjs, sheet.mjs, optional mechanics.mjs, i18n keys EN+PL, system.json entry, and entry-point import. Delegates to the archetype-scaffolder subagent.
allowed-tools: Read, Write, Edit, Bash(node:*), Bash(node tools/verify-documenttypes.mjs:*), Agent
---

# /add-archetype <name> [--mechanics] [--overlay]

Generate the complete scaffold for a new Deadlands Classic archetype.

**Communication:** reply in Polish in chat; all generated file content stays in English.

## Usage examples

- `/add-archetype toxic-shaman --mechanics` — regular archetype with a mechanics stub
- `/add-archetype harrowed --overlay` — overlay (uses `_overlays/` path + `OverlayRegistry`)
- `/add-archetype martial-artist` — minimal scaffold (manifest + data + sheet only)

## What this command does

Delegates to the `archetype-scaffolder` subagent, passing the archetype name and flags.
The scaffolder:
1. Derives all name variants (kebab → camelCase → PascalCase)
2. Creates all required `.mjs` files under `module/archetypes/<name>/`
3. Updates `system.json`, `lang/en.json`, `lang/pl.json`, `module/deadlands-classic.mjs`
4. Runs `node tools/verify-documenttypes.mjs` to confirm parity

## After scaffold is done

The scaffolder leaves stubs. To continue:
1. Verify mechanics against the rulebook: `/verify-mechanic <describe the mechanic>`
2. Implement `mechanics.mjs` based on the verified rules
3. Add Handlebars templates if the archetype needs its own tab
4. Write unit tests for any pure logic in `mechanics.mjs`
