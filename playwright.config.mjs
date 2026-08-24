/**
 * Playwright E2E configuration — LOCAL ONLY, never CI (a licensed Foundry
 * instance cannot run there; see docs/testing-e2e.md for prerequisites).
 *
 * Reuses a matching running server or launches `deadlands-test` on Foundry
 * 14.367 via Electron's embedded Node 24.15 runtime.
 *
 * @license MIT
 */

import { defineConfig } from "@playwright/test";
import { foundryWebServerCommand, getFoundryE2EConfig } from "./tools/foundry-e2e-config.mjs";

const foundry = getFoundryE2EConfig();

export default defineConfig({
  testDir: "tests/e2e",
  // One shared Foundry world = shared mutable state; specs must not overlap.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  webServer: {
    command: foundryWebServerCommand(foundry),
    url: `${foundry.baseURL}/join`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: foundry.baseURL,
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
