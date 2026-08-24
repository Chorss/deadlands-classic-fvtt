# E2E testing (Playwright) — local only

The suite drives a real, licensed Foundry **14.367** world in Chromium. CI remains
license-free; this is the maintainer's local pre-merge gate.

## One-time setup

1. Install Foundry 14.367. Defaults assume the Linux executable at
   `~/foundryvtt/foundryvtt` and data at `~/.local/share/FoundryVTT`.
2. Create a throwaway world named **`deadlands-test`** using `deadlands-classic`.
3. Symlink this checkout as `Data/systems/deadlands-classic`.
4. Keep a passwordless Gamemaster named `Gamemaster`. A missing passwordless
   `Player` is created by the race spec; an existing Player is never modified.
5. Install the browser once: `npx playwright install chromium`.

Override local paths without committing secrets:

```bash
FOUNDRY_EXECUTABLE=/path/to/foundryvtt \
FOUNDRY_DATA_PATH=/path/to/FoundryVTT \
FOUNDRY_WORLD=deadlands-test \
npm run test:e2e
```

`FOUNDRY_PORT` defaults to `30000`; `FOUNDRY_URL` can override the complete URL.
No Foundry license key, administrator password, or world-user password belongs in
repo configuration.

## Running

```bash
npm run test:e2e
```

That one command runs the doctor and then Playwright. The doctor blocks on a missing
world, wrong system, broken/wrong symlink, missing Chromium, user mismatch, or an
installed build different from `system.json.compatibility.verified`.

Playwright reuses a running server only when `/join` identifies `deadlands-test`; it
does not stop that process. If the server is down, `webServer` launches the world
directly through `ELECTRON_RUN_AS_NODE=1`, using Foundry 14.367's embedded Node 24.15,
with update checks, IP discovery and UPnP disabled. A small preload removes Electron's
desktop-runtime marker so Foundry follows its server-only path. Playwright stops only the
process it launched.

The world is shared mutable state, so all specs run with one worker. Failure screenshots
land in `test-results/` (gitignored). Use only a throwaway test world.

## Covered flows

| Spec | Verifies |
|---|---|
| `boot.spec.mjs` | world/system boot, public API shape, clean console |
| `actor-sheets.spec.mjs` | every actor type fully renders without raw i18n keys |
| `trait-roll.spec.mjs` | sheet → trait dialog → chat card |
| `fate-pot-race.spec.mjs` | concurrent GM/player Fate Pot and Action Deck writes |
| `faith-denial-effect.spec.mjs` | Active Effect creation, severity and native world-time expiry |
| `detached-sheet.spec.mjs` | native ApplicationV2 detach, tabs/actions, persisted form edit and popup cleanup |

Every created Actor and Combat is deleted in `finally`; detached popups and browser
contexts are closed. A manually started Foundry server remains running.
