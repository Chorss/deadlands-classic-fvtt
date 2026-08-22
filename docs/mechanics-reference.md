# Mechanics citation index

> ⚠ **This is an index of pointers, not the source of truth.** The authoritative source for every
> rule below is the rulebook repo **`deadlands-rules-ref`** (`$DEADLANDS_RULES_PATH`; catalog
> `index/README.md` lists all 71 books). Where this doc and the rulebook disagree, **the rulebook
> wins** and this doc is what gets fixed. Re-verify via the `pdf-reference-lookup` subagent before
> coding — a 2026-06-17 audit found drift here, and a 2026-08-22 audit found seven more
> discrepancies (see `.claude/rules/rulebook-authority.md`).
>
> **Why an index and not a summary.** Compressing a multi-page subsystem into one sentence is the
> mechanism that produced the worst errors this file has carried — it had the Shaman's Appeasement
> economy backwards and inverted the core dice-pool rule. So the "In brief" column exists **only for
> claims verified line-by-line against the extracts**. Everything else carries a page citation and
> nothing more: a pointer cannot drift, a summary can.
>
> Page citations (`dlc` = *Deadlands Classic 20th Anniversary Edition*) are **physical PDF pages**,
> matching the `[p.NNN]` markers in the extracts — no offset adjustment applies. **Never paste
> rulebook prose** into code, packs, commits, or issues. Full design detail:
> `implementation-plan.md` §3.

## 1. Core resolution

| Rule | Cite | In brief |
|---|---|---|
| Exploding dice (Aces) | `dlc p.28` | Roll the max on any die → roll it again and add, recursively. All die types. |
| Trait/Aptitude roll | `dlc p.29`, `p.157` | The **Trait** supplies the die **type**; the **Aptitude level** supplies the die **count** (hexslingin' 5 with Spirit d10 → 5d10). Take the **highest single** die, never the sum. |
| Raises | `dlc p.29` | One raise per full 5 over the TN. |
| Bust | `dlc p.29` | The majority of the dice come up 1s. |
| TN ladder | `dlc p.28` | Foolproof 3, Fair 5, Onerous 7, Hard 9, Incredible 11. |

> The die-type/die-count rule above was **inverted** in this document until 2026-08-22. The code was
> always correct (`module/core/dice/trait-roll.mjs`); only the doc was wrong.
>
> `TN_CHOICES` in the roll dialog also offers 13/15/17/19 — a **house rule**, not RAW. See
> `notes.md`.

## 2. Action Deck initiative

| Rule | Cite | In brief |
|---|---|---|
| Cards drawn | `dlc p.116` | Quickness roll vs Fair (5): 1 card **plus 1 for every success and raise**. The 5-card ceiling applies **absent supernatural aid** — a hex or Harrowed power can exceed it. |
| Bust | `dlc p.116` | Draw 0 cards. |
| Deck | `dlc p.116` | 54 cards (52 + 2 Jokers). Act highest → lowest. |
| Suit tiebreaker | `dlc p.117` | ♠ > ♥ > ♦ > ♣. |
| Red Joker | `dlc p.118` | Act at any point in the round, and draw a Fate Chip. |
| Black Joker | `dlc p.118` | Discard the Joker **and** the sleeve card; the Marshal draws a chip from the Pot. |
| Joker chips are posse-only | `dlc p.118` | The Marshal gets no draw from an NPC's Red Joker, and the posse gets none from the Marshal's Black Joker. The act-anytime and discard effects still apply. |
| Reshuffle — two triggers | `dlc p.116`, `p.118` | Deck exhausted mid-round → shuffle the discards back in **immediately**, so no card is dealt twice. Black Joker → finish the round, then reshuffle (both sides). |
| Sleeve card / surprise | `dlc p.117` | — |

*Implementation simplification: one shared deck for the whole combat rather than separate posse and
Marshal decks — see `notes.md`.*

## 3. Fate Chips

| Rule | Cite | In brief |
|---|---|---|
| White (1 BP) | `dlc p.148` | +1 die on a Trait/Aptitude roll; spend one at a time. Negates 1 wound or 5 Wind. |
| Red (2 BP) | `dlc p.148` | Roll **one bonus die** and add it to your highest die. Max 1/action. **Marshal's Tithe** on Trait/Aptitude rolls only. Negates 2 wounds / 10 Wind. |
| Blue (3 BP) | `dlc p.148` | As Red, no Tithe. Max 1/action. 3 wounds / 15 Wind. |
| Legend (5 BP) | `dlc p.148` | Either as a Blue chip **or** as a reroll — alternatives, not additive. The reroll grants no bonus die, is the only way to redo a Bust, and permanently consumes the chip. 5 wounds / all Wind. |
| "No Going Back" | `dlc p.148` | Once a Red, Blue or Legend has been spent on an action, no more Whites on it. |
| Bust | `dlc p.147` | White/Red/Blue cannot be spent on a Bust — only a Legend reroll. |
| Spent chips | `dlc p.26` | Return to the Fate Pot. The Legend reroll is the sole exception. |
| Carry cap | `dlc p.147` | 10 chips; overflow converts to Bounty Points. |
| Starting Pot | `dlc p.26`, `p.146` | 50 White / 25 Red / 10 Blue; Legend not seeded. |
| Session economy | `dlc p.146-147` | — |
| Chips cannot be spent on damage | `dlc p.137`, `p.147` | — |

**Storage:** the Pot is a world-level setting (a `{white,red,blue,legend}` DataModel); player-held
chips are integers on the actor (`system.chips.*`).

## 4. Hit locations

| Rule | Cite | In brief |
|---|---|---|
| d20 table | `dlc p.133` | `1–4` Legs · `5–9` Lower Guts · `10` Gizzards · `11–14` Arms · `15–19` Upper Guts · `20` Noggin. |
| Limb side | `dlc p.133` | Roll a separate die: odd = left, even = right. |
| Raises | `dlc p.133` | Each raise may shift the location by ±1; using them is optional and partial. |
| Guts pooling | `dlc p.139` | Gizzards, Upper Guts and Lower Guts sum into one shared guts severity, used for both the wound penalty and bleeding. |
| Bonus dice by location | `dlc p.137-138` | — |

> **Terminology:** the book's hit-location table has 6 rows (8 targets once arms and legs split
> left/right), and it tracks wounds in 6 areas. This system's 8-slot schema is an implementation
> choice, not the book's own layout.

## 5. Wounds

| Rule | Cite | In brief |
|---|---|---|
| Five tiers | `dlc p.139` | Light (1) → Heavy (2) → Serious (3) → Critical (4) → Maimed (5). |
| Wound penalty | `dlc p.140` | From the single **highest** current wound (−1/−2/−3/−4/−5), never a sum; the pooled guts area counts as one location. Compute it in `prepareDerivedData`, not as 8 ActiveEffects. |
| Maimed limb | `dlc p.139` | Severed, crushed, or permanently out of action. The book states **no Pace formula** for it — the −2/−4 Pace figures belong to the *lame* and *limp* Hindrances, a different rule. |
| Maimed guts or noggin | `dlc p.139` | Death. |
| Above maimed | `dlc p.140` | A location never exceeds maimed, but **excess wounds still count** for damage prevention and Fate Chip purposes — clamping the stored value at 5 loses information the chip-spend path needs. |
| Damage total → wounds (Size) | `dlc p.138` | — |
| Armor vs massive damage | `dlc p.138` | — |
| Stun checks, Stun & Recovery table | `dlc p.140-141` | — |

## 6. Wind

| Rule | Cite | In brief |
|---|---|---|
| Pool | `dlc p.40` | `wind.max` = Vigor die + Spirit die, by face value (the book's own example: d8 + d10 = 18). |
| Winded | `dlc p.40`, `p.141` | Wind 0 → effectively out of the action: no cards, no actions. |
| Bleeding | `dlc p.142` | Per round: Serious −1, Critical −2, maimed limb −3. The pooled guts wound bleeds once, from its shared severity. |
| Wind loss per wound level | `dlc p.141` | — |
| Negative Wind → extra guts wound | `dlc p.142` | — |

## 7. Grit

Mental toughness earned by surviving horror; mitigates Guts checks. A character who returns from
the grave gains +1 Grit (`dlc p.197`); `dlc p.253` is where Grit feeds *into* the return roll, not
where it is gained.

## 8. Guts / Fear

| Rule | Cite |
|---|---|
| Fear Levels | `dlc p.218-220` |
| Guts check / Terror table | `dlc p.221-222` |
| Scart table | `dlc p.222` |

Guts checks resolve as ordinary Aptitude rolls. *(These three cites replace the "verify before
coding" TODO this section used to carry.)*

## 9. Damage rolls & Armor

| Rule | Cite | In brief |
|---|---|---|
| Damage pools | `dlc p.137` | **Sum** every die, unlike Trait rolls. Aces still explode and add. |
| Armor (positive) | `dlc p.135-136` | Steps the damage die type down `d20 → d12 → d10 → d8 → d6 → d4`, one rung per level; below d4, remove dice instead (`0d4` = no damage). The book's own example: 3d6 vs Armor 2 → 2d4. |
| Light Armor (negative) | `dlc p.136` | Subtracts its magnitude flat from the total — the book's example: 14 − 4 = 10. |
| Layering | `dlc p.136` | Die-type reduction first, then the flat subtraction, floored at 0. |
| Armor-piercing | `dlc p.136` | Lowers the Armor level first, and ignores Light Armor entirely. *(Not implemented.)* |

## 10. Arcane backgrounds — companion map

Each of these is a multi-page subsystem with its own tables. Read the pages; this file deliberately
does **not** summarize them, because the summaries it used to carry were wrong in both directions.

| Background | Core rules | Companion book |
|---|---|---|
| Huckster | `dlc p.154-165` | `hnh` — Hucksters & Hexes |
| Mad Scientist | `dlc p.166-175` | `snr` — Smith & Robards |
| Blessed | `dlc p.176-181` | `fb` — Fire & Brimstone |
| Shaman | `dlc p.182-193` | `ghost-dancers` — Ghost Dancers |
| Harrowed | `dlc p.194-202`, `p.251-254` | `bod` — Book o' the Dead |

Three corrections worth stating explicitly, because this file asserted the opposite:

- **Shaman Appeasement cannot be banked** (`dlc p.184`). The favor is chosen **first**, then rituals
  generate Appeasement toward that specific request; unspent points evaporate. Repeating a request
  inside 24 h raises its base cost by +1.
- **Mad Scientist blueprints** use a *mad science* roll, not Tinkerin' (`dlc p.168`). Tinkerin'
  belongs to the construction step (`dlc p.170`).
- **Huckster hexes** need a success first, and each hex has a **minimum required poker hand**
  (`dlc p.157`) — the best hand is not simply "the power level".

Blessed sin lockout (minor 1 h / major 24 h / mortal 7 days) and the faith drop on a failed Spirit
roll after sinning are verified at `fb p.103-104` and `dlc p.177`.

## 11. Harrowed — overlay, not an actor type

| Rule | Cite | In brief |
|---|---|---|
| Any PC can become Harrowed | `dlc p.194` | Implemented via `OverlayRegistry`: `system.harrowed.isHarrowed` toggles the extra schema (`dominion`, `harrowedPowers[]`, `countingCoup`) and the sheet tab. |
| Nightly Dominion contest | `dlc p.195` | Opposed Spirit, each side adding its current Dominion; the winner gains 1 Dominion per success and raise. Runs **per game session**, during sleep — not on combat start. |
| Return roll | `dlc p.253` | Opposed Spirit **+ Grit** vs the manitou, per Dominion point; the mortal wins ties. *(Not implemented — the overlay only seeds Dominion.)* |
| Powers, Counting Coup | `dlc p.198-202`, `bod` | — |
