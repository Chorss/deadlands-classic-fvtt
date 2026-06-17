# Naming conventions

Consistent casing across layers so the same concept looks the same in `system.json`, registry code, i18n keys, and the filesystem.

| Context | Convention | Example |
|---|---|---|
| `documentTypes.*` keys in `system.json` | `camelCase` | `madScientist`, `weapon` |
| Registry keys (`ArchetypeRegistry`, `ItemRegistry`, `OverlayRegistry`) | `camelCase` (match `system.json`) | `madScientist` |
| Folder and file names under `module/` | `kebab-case` | `module/archetypes/mad-scientist/data.mjs` |
| i18n key segments | `PascalCase` per segment, under `DEADLANDS.*` | `DEADLANDS.Archetype.MadScientist.Label` |
| JS classes | `PascalCase` | `MadScientistDataModel`, `CowboySheet` |
| Constants in `module/core/config.mjs` | `SCREAMING_SNAKE_CASE` | `CHIP_COLORS`, `WOUND_SEVERITIES` |
| Custom hook names | dot-namespaced `deadlandsClassic.<event>` (Foundry idiom, cf. dnd5e/pf2e) | `deadlandsClassic.preTraitRoll` |

## The rule

One concept = one spelling, adapted per context. Adding archetype `foo-bar` implies, without further discussion:

- folder: `module/archetypes/foo-bar/`
- `system.json` key: `fooBar`
- JS class: `FooBarDataModel`, `FooBarSheet`
- i18n namespace: `DEADLANDS.Archetype.FooBar.*`

Verifiable at a glance; mismatches are a review flag.

## Custom hooks

Dot-namespaced `deadlandsClassic.<event>`, matching the dnd5e/pf2e idiom (verified vs the dnd5e system).
These are **public API** — treat as stable (SemVer; a breaking change = a major version bump).

- **Separator is `.`** — never `:` nor run-together (`deadlandsClassic.preTraitRoll`, not
  `deadlandsClassic:preTraitRoll` nor `deadlandsClassicPreTraitRoll`).
- **Event segment is `lowerCamelCase`:** `deadlandsClassic.preTraitRoll`, `deadlandsClassic.chipSpent`,
  `deadlandsClassic.woundApplied`.
- **`pre*` hooks are cancelable** — returning `false` aborts the operation; plain / `post*` hooks are
  reactive (notify-only). This mirrors the dnd5e convention.
- **Keep the namespace flat** — one separator only (`deadlandsClassic.preRollDamage`, not
  `deadlandsClassic.roll.preDamage`).
