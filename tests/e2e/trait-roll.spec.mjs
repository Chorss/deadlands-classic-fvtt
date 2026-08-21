/**
 * Smoke: the click-to-roll flow — cowboy sheet → trait roll → dialog → chat
 * card. Exercises the full UI path including the (GM-local) white-chip path
 * with a zero spend. Prerequisites: docs/testing-e2e.md.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { inGame, joinAs } from "./helpers/foundry-session.mjs";

test("trait roll from the cowboy sheet produces a chat card", async ({ page }) => {
  await joinAs(page, "Gamemaster");

  const actorId = await inGame(page, async () => {
    const actor = await Actor.implementation.create({ name: "E2E Trait Roll", type: "cowboy" });
    await actor.sheet.render(true);
    return actor.id;
  });

  try {
    const messagesBefore = await inGame(page, () => game.messages.size);

    // Sheet → first trait's roll button → DialogV2 → confirm with defaults.
    await page.locator('[data-action="rollTrait"]').first().click();
    const dialogOk = page.locator('dialog button[data-action="ok"]');
    await expect(dialogOk).toBeVisible();
    await dialogOk.click();

    // A chat card lands once the roll resolves.
    await page.waitForFunction((before) => game.messages.size > before, messagesBefore, {
      timeout: 15_000,
    });
    const lastMessage = await inGame(page, () => game.messages.contents.at(-1).content);
    expect(lastMessage).toContain("E2E Trait Roll");
  } finally {
    await page.evaluate(async (id) => {
      const actor = game.actors.get(id);
      await actor?.sheet.close();
      await actor?.delete();
    }, actorId);
  }
});
