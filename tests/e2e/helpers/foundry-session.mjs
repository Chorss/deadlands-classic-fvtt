/**
 * Shared helpers for driving a local Foundry VTT session in E2E specs.
 *
 * Prerequisites (docs/testing-e2e.md): a local Foundry V14 on FOUNDRY_URL
 * (default http://localhost:30000) with the `deadlands-dev` world LAUNCHED and
 * passwordless users "Gamemaster" and "Player".
 *
 * @license MIT
 */

import { expect } from "@playwright/test";

/**
 * Console-error noise that does not indicate a system bug.
 * Keep this list short and specific.
 * @type {RegExp[]}
 */
const CONSOLE_ERROR_ALLOWLIST = [
  /Failed to load resource.*favicon/i, // dev worlds often lack a favicon
];

/**
 * Start collecting console errors on the page. Call `assertClean()` at the
 * end of the spec — it fails the test if any non-allowlisted error occurred.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {{ errors: string[], assertClean: () => void }}
 */
export function collectConsoleErrors(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") {
      return;
    }
    const text = msg.text();
    if (CONSOLE_ERROR_ALLOWLIST.some((re) => re.test(text))) {
      return;
    }
    errors.push(text);
  });
  return {
    errors,
    assertClean: () => expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]),
  };
}

/**
 * Join the launched world as the given user and wait until the game is ready.
 * Fails with an actionable message when the world is not launched (Foundry
 * serves /setup instead of /join).
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} userName — e.g. "Gamemaster" or "Player"
 */
export async function joinAs(page, userName) {
  await page.goto("/join");

  if (page.url().includes("/setup") || page.url().includes("/auth")) {
    throw new Error(
      "Foundry is not serving /join — launch the `deadlands-dev` world (and mind the setup admin password) before running E2E. See docs/testing-e2e.md."
    );
  }

  // Join form: user picker + blank password + submit.
  const userSelect = page.locator('select[name="userid"]');
  await expect(userSelect, "join form user picker not found — Foundry UI change?").toBeVisible();
  await userSelect.selectOption({ label: userName });
  await page.locator('button[name="join"], button[type="submit"]').first().click();

  // The game view is up once `game.ready` flips true.
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 30_000 });
}

/**
 * Evaluate a function inside the Foundry client with `game` available.
 * Thin alias that keeps specs terse.
 *
 * @template T
 * @param {import("@playwright/test").Page} page
 * @param {() => T | Promise<T>} fn
 * @param {unknown} [arg]
 * @returns {Promise<T>}
 */
export function inGame(page, fn, arg) {
  return page.evaluate(fn, arg);
}
