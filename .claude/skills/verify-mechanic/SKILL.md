---
name: verify-mechanic
description: Verify a Deadlands game mechanic against the authoritative rulebook source BEFORE coding it. Use when implementing or changing any mechanic — dice, fate chips, wounds, hit locations, card initiative, archetype powers (hexes/miracles/favors/gizmos), Harrowed/Dominion, or a compendium pack's mechanical effect — and you need to confirm the rule, get the page cite, and paraphrase it safely. Delegates the lookup to the pdf-reference-lookup subagent.
---

# Verify a mechanic against the source

The rulebook repo `deadlands-rules-ref` (`$DEADLANDS_RULES_PATH`) is the **only** authoritative source
for Deadlands rules. `docs/mechanics-reference.md` is a paraphrase and has been observed to drift —
never trust it (or training memory) as ground truth. Run this before committing a mechanic to code.

## Procedure

1. **State the mechanic** you are about to implement (or just implemented) in one sentence — include
   the exact value / formula / table you plan to encode.
2. **Look it up at the source.** Delegate to the `pdf-reference-lookup` subagent with a precise
   question (e.g. *"Fate chips: what does a Red chip do, and is it max 1/action?"*). It returns
   `<slug> p.NNN` + a short verifying fragment.
3. **Compare** the returned rule to your plan:
   - **Match** → cite the page in a code comment (`// <slug> p.NNN — <your paraphrase>`), paraphrase
     in your own words, and proceed.
   - **Mismatch** → **STOP. The rulebook wins.** Fix the implementation; if `docs/mechanics-reference.md`
     was the source of the error, flag it for correction too.
4. **Never paste rulebook prose** into code, comments, packs, commits, or PRs (Pinnacle IP).

## Which book

`dlc` is the core. Archetype subsystems live in companions: `hnh` (Huckster), `ghost-dancers`
(Shaman), `fb` (Blessed), `snr` (Mad Scientist), `bod` (Harrowed). PL terminology canon → MAG `*-pl`.

## Output

A short confirmation line per mechanic checked:

`<mechanic> — <slug> p.NNN — MATCH/MISMATCH — <one-line paraphrase>`

If MISMATCH, state what the code should be instead. For verifying *already-written* code or packs
across many values at once, hand off to the `mechanic-verifier` subagent instead.
