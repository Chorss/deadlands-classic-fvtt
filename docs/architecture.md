# Architecture — registry pattern

> The load-bearing design decision. Full roadmap context: `implementation-plan.md` §2 — treat the
> plan as the source of truth where they disagree. This doc is the contributor-facing summary.

## Core principle

`module/core/` is **archetype-agnostic**. Every shared mechanic — dice, cards, chips, wounds, base
character data — lives in core and operates on a base schema. Archetypes (Cowboy, Huckster, Shaman,
Blessed, Mad Scientist) are **self-contained folders** under `module/archetypes/<id>/`
(`manifest.mjs` + `data.mjs` + `sheet.mjs`, plus optional `mechanics.mjs` and HBS partials) that
register themselves into a registry at `init`.

**Why:** Deadlands expansions (Hell on Earth, Lost Colony, Smith & Robards, Book o' the Dead) each
add new archetypes. Hardcoding archetypes into core would force a core edit for every expansion. The
registry indirection decouples core from content, so expansions ship as separate modules.

## Adding a new archetype = 3 steps

1. Create `module/archetypes/<id>/{manifest,data,sheet}.mjs`.
2. Add one import line to `module/deadlands-classic.mjs`.
3. Add a key to `system.json → documentTypes.Actor`.

Nothing else changes — the new archetype inherits dice, cards, chips, wounds, Wind, and
edges/hindrances automatically.

## Three registries

- **`ArchetypeRegistry`** — PC archetypes (`cowboy`, `huckster`, `shaman`, `blessed`, `madScientist`)
  plus NPC types (`npc`, `mook`).
- **`ItemRegistry`** — item document types. Core types (`weapon`, `armor`, `gear`, `edge`,
  `hindrance`, `ammo`) registered in Phase 1; archetype-specific types (`hex`, `miracle`, `favor`,
  `gizmo`) registered by their archetype manifests in Phases 9-10.
- **`OverlayRegistry`** — cross-archetype modifiers like `harrowed` that can apply to **any** PC.

## ArchetypeDefinition contract

The only interface core cares about:

```javascript
{
  id: string,                    // matches the documentTypes.Actor key
  label: string,                 // i18n key
  dataModel: typeof foundry.abstract.TypeDataModel,
  sheetClass: typeof foundry.applications.sheets.ActorSheetV2,
  mechanics?: object,            // optional archetype-specific callbacks
  defaultIcon: string,
  htmlFields?: string[]          // for system.json documentTypes
}
```

This contract, the `deadlandsClassic.*` hooks, and the `game.deadlandsClassic` namespace are the
**public API** that expansion modules bind to — treat them as stable (SemVer; a breaking change = a
major version bump).

## Harrowed = overlay, not archetype

`dlc` p.194: any PC can become Harrowed — an overlay on a normal character, not a separate actor
type. A "Harrowed" sheet tab is injected when `system.harrowed.isHarrowed === true`; the nightly Dominion
roll (opposed Spirit + each side's current Dominion — `dlc` p.195) is an `OverlayRegistry` hook, not a new sheet.
