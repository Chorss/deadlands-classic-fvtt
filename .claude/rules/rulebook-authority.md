---
paths:
  - "module/**/*.mjs"
  - "tests/**/*.mjs"
  - "packs/**"
  - "docs/mechanics-reference.md"
---

# Game rules — one authoritative source

All Deadlands game rules (mechanics, numbers, tables, page cites) come from **one** place: the
private rules repo **`deadlands-rules-ref`** (`$DEADLANDS_RULES_PATH`). Its catalog
`index/README.md` lists **every** indexed rulebook — core (`dlc`), the archetype companions, regional
sourcebooks, adventures, magazines, the Polish MAG translations (`*-pl`), and conversions (~50 books,
each with slug, page offset, and a PASS/WARN/FAIL extract-quality flag).

## The rule

- **Authoritative source = `deadlands-rules-ref`.** When a mechanic, value, or table is in question,
  the extract wins — over training memory, over this repo's `docs/`, over the `vendor/` reference
  projects.
- **`docs/mechanics-reference.md` is a paraphrase, not the source.** It's a convenience summary and
  has been observed to drift from the books (2026-06-17 audit). Treat it as a hint; if it disagrees
  with `deadlands-rules-ref`, the rulebook is right — fix the doc.
- **Re-verify before coding.** Before implementing any mechanic, confirm it against the extracts via
  the `pdf-reference-lookup` subagent (returns `<slug> p.NNN` + a short fragment). Never code a rule
  from memory.
- **Page cites, not prose.** Cite `<slug> p.NNN` in code comments / PR bodies where it aids review.
  **Never paste rulebook prose** into code, comments, packs, commits, issues, or PRs — it's Pinnacle
  IP (see `CLAUDE.md` §PDF rulebook).

## Which book

- **Primary: `dlc`** (Deadlands Classic 20th Anniversary, 413 pp, offset +1) — the core rules.
- **Archetype subsystems live in companions:** `hnh` (Hucksters & Hexes → Huckster),
  `ghost-dancers` (Shaman), `fb` (Fire & Brimstone → Blessed), `snr` (Smith & Robards → Mad
  Scientist), `bod` (Book of the Dead → Harrowed).
- **PL terminology canon:** the MAG `*-pl` books (`pg-pl`, `mh-pl`, `char-sheet-pl`, …) — see
  `.claude/rules/localization.md`.

This complements `references.md`, which governs the **code** under `vendor/` (don't copy source).
That rule is about code provenance; **this** one is about where game **rules** come from.
