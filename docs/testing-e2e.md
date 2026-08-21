# E2E testing (Playwright) — local only

Automated smoke tests for the Foundry-dependent layer (sheets, rolls, GM-proxy)
that unit tests cannot cover. They drive a **real, local Foundry instance** in
Chromium via [`@playwright/test`](https://playwright.dev/).

> **Why local only, never CI:** Foundry VTT is commercially licensed — its
> binaries may not be committed and the license key is the owner's secret, so
> external PRs cannot run it (risk table, `implementation-plan.md` §8). CI
> stays license-free (lint, `node --test`, `verify-documenttypes`); E2E is a
> pre-merge check on the maintainer's machine, not a PR gate.

## Prerequisites

1. **Local Foundry V14** listening on `http://localhost:30000`
   (override with the `FOUNDRY_URL` env var).
2. A world named **`deadlands-dev`** using this system
   (symlink setup: `CONTRIBUTING.md` §Development).
3. The world **launched** before running the tests — the suite fails fast with
   an actionable message when Foundry serves `/setup` instead of `/join`.
4. Two **passwordless** users in the world:
   - `Gamemaster` (role: Gamemaster)
   - `Player` (role: Player) — needed by the two-client race spec.
5. One-time browser install: `npx playwright install chromium`.

⚠ **The suite mutates the dev world** (creates/deletes temporary actors and
combats, temporarily bumps the Fate Pot). Use a throwaway world, never a real
campaign.

## Running

```bash
npm run test:e2e                          # default: http://localhost:30000
FOUNDRY_URL=http://localhost:30001 npm run test:e2e
npx playwright test tests/e2e/boot.spec.mjs   # single spec
```

Specs run sequentially (`workers: 1`) — one shared world means shared mutable
state. Failure screenshots land in `test-results/` (gitignored).

## What is covered

| Spec | Verifies |
|---|---|
| `boot.spec.mjs` | World boots with `deadlands-classic` active, public API shape, zero console errors |
| `actor-sheets.spec.mjs` | Every registered actor type renders its sheet with no raw `DEADLANDS.*` i18n keys |
| `trait-roll.spec.mjs` | Click-to-roll flow: sheet → roll dialog → chat card |
| `fate-pot-race.spec.mjs` | **GM-proxy regression**: two clients (GM + player, separate browser contexts) concurrently return chips and deal cards — no lost updates, no duplicate cards (`module/core/gm-proxy.mjs`) |

Deliberately deferred follow-ups: an i18n-switch spec (EN↔PL) and a
chip-spend-UI spec (widget-driven, not API-driven).

## Manual checks not automated

- **No-GM hard block**: log out the GM, spend a white chip as a player → a
  localized warning appears and the actor's chips stay untouched. (Automating
  this needs a GM-less world state that would break the other specs' setup.)

## Screenshots

`README.md` §Screenshots lists planned captures (`assets/screenshots/`). Take
them during an E2E session — the suite conveniently drives the sheets and
combat tracker into presentable states.
