# Open questions & design notes

## Guts wound-pool consolidation (Phase 6, unresolved)

**Mechanic:** `dlc [p.139]` — "Wounds taken to the gizzards and upper and lower guts add to
those in the guts area." The three sub-locations (`lowerGuts`, `gizzards`, `upperGuts`) form a
single shared accumulation pool for the purpose of severity and death checks.

**Current implementation:** `HIT_LOCATIONS` in `config.mjs` and `applyWounds` in `wound-track.mjs`
treat the three sub-locations as independent severity pools (0–5 each). A character could take 4
wounds to `lowerGuts` and 4 to `upperGuts` without triggering the Maimed/death threshold, which
contradicts the rulebook.

**Decision needed (before `applyWounds` is wired to combat):** two options:

1. **Merge** — collapse `lowerGuts`, `gizzards`, `upperGuts` into a single `guts` field in the
   schema. Hit-location draw maps 1–4→legs, 5–9→`lowerGuts` (display), 10→`gizzards` (display),
   but all write to `system.wounds.guts.severity`. Schema migration needed.

2. **Virtual pool** — keep the three schema fields for granularity; add a derived
   `system.wounds.guts.total` in `prepareDerivedData` that sums all three severities and is capped
   at 5. The wound penalty and death check read `guts.total`, not individual slots.

Option 1 is simpler and more faithful to the rulebook narrative. Option 2 preserves more detail for
visual display but adds complexity. **Decision: TBD (maintainer).**

Tracked by: Phase 6 implementation, `module/core/wounds/wound-track.mjs`.

---

## Page citation convention

In code comments, `dlc p.NNN` uses **physical PDF page numbers** (1-indexed from cover, offset +1
from printed page numbers). A reader with a physical book should subtract 1 to find the printed
page. Example: `dlc p.40` in code = printed p.39. The offset (+1) is documented in
`deadlands-rules-ref/index/README.md`. Consider adding a one-line note to this effect in a shared
location so future contributors aren't confused.
