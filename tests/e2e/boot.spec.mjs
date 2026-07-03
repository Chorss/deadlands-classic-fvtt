/**
 * Smoke: the world boots with this system active and no console errors.
 * Prerequisites: docs/testing-e2e.md.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { collectConsoleErrors, inGame, joinAs } from "./helpers/foundry-session.mjs";

test("world boots as Gamemaster with deadlands-classic active and a clean console", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);

  await joinAs(page, "Gamemaster");

  const systemId = await inGame(page, () => game.system.id);
  expect(systemId).toBe("deadlands-classic");

  const apiShape = await inGame(page, () => Object.keys(game.deadlandsClassic ?? {}).sort());
  expect(apiShape).toEqual(
    ["archetypes", "cards", "chips", "config", "dice", "id", "items", "overlays", "wounds"].sort()
  );

  consoleErrors.assertClean();
});
