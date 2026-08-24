/**
 * Shared helpers for driving a local Foundry VTT session in E2E specs.
 *
 * Prerequisites (docs/testing-e2e.md): a local Foundry V14 on FOUNDRY_URL
 * (default http://localhost:30000) with the `deadlands-test` world and
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
      "Foundry is not serving /join for `deadlands-test`. Run npm run test:e2e so the doctor can diagnose the local setup."
    );
  }

  // V14.366 replaced the user select with an autocomplete-enabled text field.
  const username = page.locator('input[name="username"]');
  const password = page.locator('input[name="password"]');
  await expect(username, "join username input not found — Foundry UI change?").toBeVisible();
  await username.fill(userName);
  await password.fill("");
  await page.locator('button[name="join"]').click();

  // The game view is up once `game.ready` flips true.
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 30_000 });
}

/**
 * Ensure the race-test Player exists. Existing users are never modified: a
 * password on an existing Player remains a doctor error, never something the
 * test silently clears.
 */
export async function ensurePasswordlessPlayer(page, userName = "Player") {
  return inGame(
    page,
    async (name) => {
      const existing = game.users.getName(name);
      if (existing) {
        if (existing.password) {
          throw new Error(`Existing Player user "${name}" has a password; E2E will not change it.`);
        }
        return existing.id;
      }
      const player = await User.implementation.create({
        name,
        role: CONST.USER_ROLES.PLAYER,
        password: "",
      });
      return player.id;
    },
    userName
  );
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
