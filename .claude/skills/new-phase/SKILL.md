---
name: new-phase
description: Start a new implementation phase — creates branch, extracts the checklist from docs/implementation-plan.md, identifies companion PDFs to verify.
allowed-tools: Bash(git fetch:*), Bash(git status:*), Bash(git log:*), Bash(git branch:*), Bash(git checkout:*), Bash(grep:*), Bash(awk:*), Read, Glob
argument-hint: "[N] [slug]"
---

# /new-phase [N]

Start implementation phase N of the Deadlands Classic Foundry VTT system.

**Communication:** reply in Polish in chat; all file content stays in English.

## Step 1 — Parse the phase number

The user invokes `/new-phase N` (e.g. `/new-phase 11`) or `/new-phase N slug`
(e.g. `/new-phase 11 harrowed`). If N is missing, ask for it.

## Step 2 — Verify working tree is clean

```bash
git fetch origin
git status --porcelain
git rev-list --left-right --count origin/main...HEAD
```

Stop and report if:
- Working tree is dirty (uncommitted changes) — list them, ask to commit or stash.
- Current branch is not `main` — report current branch, ask whether to proceed.
- `main` is behind `origin/main` — ask the user to pull first.

## Step 3 — Extract phase section from the plan

Read the phase section from `docs/implementation-plan.md`:

```bash
awk '/^### Phase '"N"' /{f=1;print;next} f&&/^### Phase /{exit} f' \
  docs/implementation-plan.md | head -80
```

(Not an `awk` range — a range tests its end pattern against the *same* record, so
`/^### Phase N /,/^### Phase [0-9]/` matches start and end on the heading itself and prints
one line.)

**Phases 0-14 are all closed** and §5 now holds only their heading plus a one-line scope, so the
extraction returns no file list and no test block for them. New work after 0.4.1 is tracked in
§12 of the plan, not as a numbered phase — read that section instead of inventing a Phase 15.

Parse out:
- **Title** — the text after `### Phase N — `
- **Slug** — derive from the title (lowercase, spaces→hyphens, drop Polish diacritics)
  or use the slug the user provided.
  Examples: "Harrowed overlay" → `harrowed`, "Edges, Hindrances" → `edges-hindrances`
- **Files list** — numbered lines starting with a digit and ending in `.mjs`/`.hbs`/`.css`/`.json`
- **Test block** — everything after `**Test:**` until next heading
- **Companion books** — scan the section text for slugs like `bod`, `hnh`, `ghost-dancers`,
  `fb`, `snr`, `dlc`. Also check for the phrase `companion` or `w `deadlands-rules-ref``.

## Step 4 — Create the branch

```bash
git checkout -b phase-N/slug
```

Where N is the phase number and slug is derived in Step 3.
Example: `phase-11/harrowed`

## Step 5 — Display the checklist

Print a structured checklist in this format (Polish labels, English values):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Faza N — <Title>
 Gałąź: phase-N/<slug>

 Pliki do stworzenia:
  □ module/archetypes/_overlays/harrowed/manifest.mjs
  □ module/archetypes/_overlays/harrowed/data-schema.mjs
  □ ...

 Test akceptacyjny:
  <extracted Test block — exact text from plan>

 Companion PDFs do weryfikacji mechanik:
  □ bod  — Book of the Dead (Harrowed)         → /verify-mechanic <mechanic>
  □ dlc  — Deadlands Classic core               → /verify-mechanic <mechanic>

 Przed commitami:
  □ node tools/verify-documenttypes.mjs
  □ node --test tests/*.test.mjs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Companion book map (for step 3 detection)

| Keyword in plan text | Slug | Book |
|---|---|---|
| `hnh` or `Huckster` | `hnh` | Hucksters & Hexes |
| `ghost-dancers` or `Shaman` | `ghost-dancers` | Ghost Dancers |
| `fb` or `Blessed` | `fb` | Fire & Brimstone |
| `snr` or `Mad Scientist` | `snr` | Smith & Robards |
| `bod` or `Harrowed` | `bod` | Book of the Dead |
| _(always include)_ | `dlc` | Deadlands Classic core |

## Hard rules

- ❌ Never create the branch if the working tree is dirty.
- ❌ Never invent companion slugs — only list what appears in the plan text.
- ✅ Include `dlc` in companions by default (core rules always apply).
- ✅ Checklist items are actionable (checkbox format so the user can track progress).
