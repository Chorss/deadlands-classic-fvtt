/**
 * Playwright E2E configuration — LOCAL ONLY, never CI (a licensed Foundry
 * instance cannot run there; see docs/testing-e2e.md for prerequisites).
 *
 * Requires a running Foundry V14 with the `deadlands-dev` world launched.
 * Override the URL with FOUNDRY_URL when the instance is not on :30000.
 *
 * @license MIT
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // One shared Foundry world = shared mutable state; specs must not overlap.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.FOUNDRY_URL ?? "http://localhost:30000",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
