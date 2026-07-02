# Open questions & design notes

## Guts wound-pool consolidation (Phase 6, resolved)

**Mechanic:** `dlc [p.139]` — wounds dealt to the gizzards and the upper/lower guts accumulate in
the shared guts area. The three sub-locations (`lowerGuts`, `gizzards`, `upperGuts`) form a
single shared accumulation pool for the purpose of severity and death checks.

**Prior implementation:** `HIT_LOCATIONS` in `config.mjs` and `applyWounds` in `wound-track.mjs`
treated the three sub-locations as independent severity pools (0–5 each). A character could take 4
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

---

## What does the MIT license give me?

MIT is a permissive license — one of the simplest and most popular in open source (~150 words of
license text).

**What you can do:**
- Use, copy, and distribute the code
- Modify it and create derivative works (including commercial, including closed-source)
- Sell copies without any restrictions

**What others must do when using your code:**
- Keep the license text and copyright notice in their distribution
- That's all. No obligation to share their changes or to stay on MIT.

**Why MIT makes sense for this project:**
- A niche system (Deadlands Classic, small community) needs **adoption > protection against a
  commercial fork**
- The Foundry VTT ecosystem is dominated by permissive licenses: dnd5e — MIT, pf2e — Apache-2.0,
  most community modules — MIT
- RhombusWeasel (one of the two reference projects in the repo) is MIT — zero license conflict
- Dulux-Oz is GPL-3.0, but we don't copy its code — at most we learn patterns from it, and
  architectural patterns are not protected by copyright
- Low barrier to entry for contributors

**Practical consequences for Foundry VTT:**
- Anyone can fork and build commercial modules on top of our code — we accept that in exchange for
  wide adoption
- Pinnacle Entertainment Group (creator of Deadlands) has no rights to the system's code, only to
  the content (lore, artwork, rules tables from the PDFs)
- Compendium pack content (edge/hindrance/hex names, short mechanical descriptions) is written in
  our own words — MIT on the code does not legalize copying text owned by Pinnacle

## Trademark & fan content — more important than prose copyright (audit 2026-06-17)

This is **not** just a question of text copyright — it is first and foremost a **trademark**
question.

- **"Deadlands" is a Pinnacle trademark**, and the official **PEG Fan License explicitly
  EXCLUDES** the Deadlands setting (as does the paid SWAG program). There is no licensing safe
  harbor for a fan product branded "Deadlands" — only enforcement discretion. Pinnacle
  *deliberately* excluded this setting, which is a strong "reserved" signal.
- MIT protects *our code*, not the brand. A public system with `id: deadlands-classic` uses the
  mark in a way no current policy permits. The realistic risk = a **C&D / takedown** of the repo
  and package (not damages — non-commercial, no copied prose).
- **Decision D1 — consciously accepted risk:** we keep `deadlands-classic` + the "unofficial /
  not affiliated with Pinnacle" disclaimer (README §License, in place). **Note:** the manifest
  `id` is practically irreversible after the first public Release (changing it breaks world
  updates) — **reconsider at publication time** (either written PEG permission or a neutral name).
- Source: shop.peginc.com/pages/licensing. Full risk register: `implementation-plan.md` §8.

## AI workshop — why this split (rules + skills + subagents + MCP)?

The four Claude Code mechanisms solve **different** problems — they are easy to confuse, hence
this fixed map.

**`.claude/rules/` — passive facts and prohibitions.**
- Auto-loaded into context when Claude reads files matching the `paths:` frontmatter (or always,
  when there is no `paths:`).
- They don't ask for anything, they state ("never V13 API", "EN/PL parity mandatory", "don't copy
  from the GPL reference tree").
- Rules in this project: `commits.md`, `naming.md`, `code-quality.md` (always); `v14-api.md`,
  `localization.md`, `references.md`, `rulebook-authority.md` (contextual).

**`.claude/skills/` + `.claude/commands/` — active procedures.**
- Invoked via `/name` in a prompt, or automatically when the `description:` semantically matches
  the task.
- They do something ("scaffold an archetype", "verify a mechanic against the rulebook", "run the
  system sanity check").
- In this project: the `verify-mechanic` skill plus the `/add-archetype`, `/new-phase`,
  `/release`, `/verify-system` commands.

**`.claude/agents/` — dedicated specialists.**
- A subagent is a separate Claude session with its own context and a restricted toolset. The
  parent delegates a task to it and gets a summary back — detailed results don't pollute the main
  context.
- In this project: `pdf-reference-lookup` (mechanic lookups from the PDFs without dragging the
  rulebook into the parent session), `archetype-scaffolder`, `foundry-v14-checker`,
  `mechanic-verifier`.

**`.mcp.json` — extending Claude with new tools.**
- Not an instruction — **new tools**. An MCP server registers tools (e.g. `browser_click`,
  `resolve-library-id`) and Claude uses them like native ones.
- **Playwright MCP** — gives Claude browser control. Without it, verifying Foundry sheets is
  manual ("take a screenshot, paste what you see"). With it: Claude opens the world itself,
  clicks, reads the DOM, and reports whether it works.
- **context7 MCP** — concise library-docs lookup. An alternative to `WebFetch`, which returns raw
  HTML. Especially useful for the Foundry V14 API — faster and cheaper in context.

**Why not everything as skills?**
Skills are designed for "I can perform procedure X" — forcing standing prohibitions ("don't write
V13 API") into skills fights the tool. Naming conventions, licensing constraints, and the i18n
parity requirement are rules, not skills. Conversely: archetype scaffolding is a skill (a
procedure), not a rule.

**Why not everything as subagents?**
A subagent has a cost — a separate prompt, a separate context, an extra hop. Use one only where
(a) the parent's context must not be polluted (e.g. thousands of lines of PDF text), or (b)
specialization justifies a dedicated system prompt. For everyday tasks — rules + skills are
enough.
