# Mechanics quick reference

> ⚠ **This is a paraphrase, not the source of truth.** The authoritative source for every rule below is
> the rulebook repo **`deadlands-rules-ref`** (`$DEADLANDS_RULES_PATH`; catalog `index/README.md` lists
> all ~50 books). Where this doc and the rulebook disagree, **the rulebook wins** and this doc is what
> gets fixed. Re-verify via the `pdf-reference-lookup` subagent before coding — a 2026-06-17 audit found
> drift here (see `.claude/rules/rulebook-authority.md`).
>
> Paraphrased summary of Deadlands Classic mechanics for implementation. Page citations
> (`dlc` = *Deadlands Classic 20th Anniversary Edition*) are for verification against the rulebook —
> **never paste rulebook prose** into code/packs/commits. Full design detail: `implementation-plan.md` §3.

## 1. Exploding dice (Aces)
Roll the max on any die → roll it again and add, recursively. All die types (d4–d20).

## 2. Trait rolls (dice pools)
Each Trait has a die type **and** a die count (e.g. Nimbleness 4d8). Roll all dice, take the
**highest single** result (not the sum). Skill/Aptitude rolls use the governing Trait's die count.
- **Raises** = `floor((highest − TN) / 5)` above the TN.
- **Bust** = the majority of dice come up 1s.

## 3. Poker-card initiative (Action Deck) — `dlc` p.116-118
No dice for the order itself. Each round make a **Quickness roll vs TN 5 (Fair)** and draw
**1 card + 1 per success and raise** (max 5) from a 54-card deck (52 + 2 Jokers). Act highest → lowest. Suit tiebreaker: **♠ > ♥ > ♦ > ♣**. Red Joker = best (act anytime + draw a Fate
Chip). Black Joker = backlash (discard your sleeve card; the Marshal draws a chip from the Pot;
reshuffle at end of round).

## 4. Fate Chips — four colors — `dlc` p.146-148
- **White** (1 BP) — +1 extra die on a Trait/Aptitude roll (stack multiple Whites until the first
  Red/Blue/Legend). Negates 1 wound OR 5 Wind.
- **Red** (2 BP) — roll **one bonus die**, add its result to your highest die (not a flat +1). Max
  **1/action**. **Marshal's Tithe**: the Marshal draws a chip from the Pot when a player spends Red.
  Negates 2 wounds / 10 Wind.
- **Blue** (3 BP) — as Red but **no** Marshal's Tithe. Max 1/action. 3 wounds / 15 Wind.
- **Legend** (5 BP) — use **as a Blue chip OR as a Reroll** of any roll (alternative uses, not
  additive); the Reroll grants no bonus die and is the only way to redo a Bust; it permanently consumes the chip.
  5 wounds / all Wind.

Going Bust: White/Red/Blue cannot save the roll — only a Legend reroll. 10-chip carry cap; overflow
converts to Bounty Points. Starting Pot: 50 White / 25 Red / 10 Blue / 0 Legend (`dlc` p.145).
**Storage:** the Pot is a world-level setting (a `{white,red,blue,legend}` DataModel); player-held
chips are integers on the actor (`system.chips.*`).

## 5. Hit locations — 8 slots — `dlc` p.133 (roll 1d20)
`1–4` Legs · `5–9` Lower Guts · `10` Gizzards · `11–14` Arms · `15–19` Upper Guts · `20` Noggin.
Left/right limb: roll a separate die — odd = left, even = right. Slots: Noggin, Upper Guts, Lower Guts,
Gizzards, Left/Right Arm, Left/Right Leg. Each **raise** lets the attacker shift the location by ±1.

## 6. Wound severity — 5 tiers — `dlc` p.139 (character sheet p.412-413)
`Light (1) → Heavy (2) → Serious (3) → Critical (4) → Maimed (5)`. Each location tracks
`severity: 0-5`. Compute the cumulative wound penalty in `prepareDerivedData` (not 8 independent
ActiveEffects). Maimed = location unusable (Arm → can't use that hand; Leg → halved Pace).

## 7. Wind — `dlc` p.40
Secondary stamina pool. `wind.max = Vigor die + Spirit die` (face values: d8 = 8, etc.). Lost to
non-lethal damage, fatigue, and fear. Wind 0 → **Winded** (effectively out of the action; `dlc` p.40).

## 8. Grit
Mental toughness earned by surviving horror; mitigates Fear (Guts) checks.

## 9. Guts / Fear (terror check)
Core Deadlands horror mechanic (system: Phase 6A). Facing something frightening → roll **Guts**
(governed by Spirit) vs a TN set by the scene's Fear Level; failure inflicts effects (Wind loss, fear
conditions). Verify exact tiers/effects in `dlc` (fear / Fear Level chapter) before coding.

## 10. Arcane Backgrounds
- **Huckster** — hexslingin' roll, then draw poker cards; best poker hand = power level. Black Joker → Backlash.
- **Shaman** — bargains with spirits via rituals/fetishes; accumulates Appeasement, spends on Favors.
- **Blessed** — faith powers (Conviction); a sin tracker reduces Faith.
- **Mad Scientist** — theory → blueprint (poker hand) → construction (Tinkerin' roll) → reliability
  (d20 check on every use).

## 11. Harrowed — overlay, not an actor type — `dlc` p.194
Any PC can become Harrowed. Implemented via `OverlayRegistry`: the flag `system.harrowed.isHarrowed`
toggles behavior; extra schema (`dominion`, `harrowedPowers[]`, `countingCoup`); a "Harrowed" tab is
injected when the flag is true; the **nightly Dominion contest** (opposed Spirit, each side adds their current Dominion — `dlc` p.195) runs **per game session** (during sleep), not on combat start. The one-time return roll on becoming Harrowed adds Grit instead (`dlc` p.253).
