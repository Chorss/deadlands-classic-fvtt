# Open questions & design notes

## Guts wound-pool consolidation (Phase 6, resolved)

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
visual display but adds complexity.

**Resolved:** Option 2 (virtual pool). `HIT_LOCATIONS` marks the three sub-locations
`gutsGroup: true`; `gutsTotal()` in `wound-track.mjs` sums their severities capped at
`WOUND_MAX`; `highestWoundPenalty()` and `totalBleedingRate()` (bleeding drain, dlc p.142) both
read the pooled total for guts locations instead of each one independently. No schema migration.

Tracked by: Phase 6 implementation, `module/core/wounds/wound-track.mjs`.

---

## Fate Pot / Action Deck cross-client race (hotfix follow-up, unresolved)

**Current implementation:** `FatePot` and `ActionDeck` each serialize their read-modify-write
calls through a `KeyedAsyncQueue` (`module/core/async-queue.mjs`) so two overlapping async calls
*on the same client* can't interleave between `await` points and lose an update (e.g. a chip
return racing a Marshal's Tithe draw, or two `deal()` calls fired close together).

**Known limitation:** this only serializes within one browser tab. A genuinely simultaneous write
from two different clients (two players, or a player and the GM) racing on the same world setting
or combat flag can still interleave, since Foundry's world-scope `Setting` and document flags have
no native compare-and-swap.

**Closing this fully would need:** a GM-owned, socket-serialized queue — every client sends a
patch request over the socket, only the GM's client actually reads-modifies-writes the setting/flag,
one at a time. Bigger architectural change, not a hotfix. **Decision: TBD (maintainer).**

Tracked by: `module/core/chips/fate-pot.mjs`, `module/core/cards/action-deck.mjs`.

---

## Page citation convention

In code comments, `dlc p.NNN` uses **physical PDF page numbers** (1-indexed from cover, offset +1
from printed page numbers). A reader with a physical book should subtract 1 to find the printed
page. Example: `dlc p.40` in code = printed p.39. The offset (+1) is documented in
`deadlands-rules-ref/index/README.md`. Consider adding a one-line note to this effect in a shared
location so future contributors aren't confused.
