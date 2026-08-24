/**
 * ApplicationV2 native detach regression: the actor sheet remains fully
 * interactive and persists form changes after moving into a popup window.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { collectConsoleErrors, inGame, joinAs } from "./helpers/foundry-session.mjs";

test("a detached ApplicationV2 actor sheet renders, navigates and saves", async ({
  context,
  page,
}) => {
  const mainConsole = collectConsoleErrors(page);
  await joinAs(page, "Gamemaster");

  const fixture = await inGame(page, async () => {
    const actor = await Actor.implementation.create({ name: "E2E Detached Sheet", type: "cowboy" });
    await actor.sheet.render(true);
    return { actorId: actor.id, sheetId: actor.sheet.id };
  });

  let popup;
  try {
    const sheet = page.locator(`#${fixture.sheetId}`);
    await expect(sheet).toBeVisible();
    await sheet.locator('button[data-action="toggleControls"]').click();

    const detachIndex = await page.evaluate(() =>
      ui.context.menuItems.findIndex((item) => item.label === "APPLICATION.ACTIONS.Detach")
    );
    expect(detachIndex, "core ApplicationV2 detach action is missing").toBeGreaterThanOrEqual(0);
    const detachAction = page.locator("#context-menu .context-item").nth(detachIndex);
    await expect(detachAction).toBeVisible();
    const popupPromise = context.waitForEvent("page");
    await detachAction.click();
    popup = await popupPromise;
    const popupConsole = collectConsoleErrors(popup);

    const detachedSheet = popup.locator(`#${fixture.sheetId}`);
    await expect(detachedSheet).toBeVisible();
    await expect(detachedSheet.locator(".dlc-sheet-header")).toBeVisible();

    await detachedSheet.locator('[data-action="tab"][data-tab="combat"]').click();
    await expect(detachedSheet.locator('.tab[data-tab="combat"]')).toHaveClass(/active/);
    await detachedSheet.locator('[data-action="toggleEditMode"]').click();
    await expect(detachedSheet.locator('[data-action="toggleEditMode"]')).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    const renamed = "E2E Detached Sheet Saved";
    await detachedSheet.locator('input[name="name"]').fill(renamed);
    await detachedSheet.locator('input[name="name"]').blur();
    await page.waitForFunction(({ id, name }) => game.actors.get(id)?.name === name, {
      id: fixture.actorId,
      name: renamed,
    });
    expect(await inGame(page, (id) => game.actors.get(id)?.name, fixture.actorId)).toBe(renamed);

    popupConsole.assertClean();
    await popup.close();
    await expect.poll(() => popup.isClosed()).toBe(true);
  } finally {
    if (popup && !popup.isClosed()) {
      await popup.close();
    }
    await inGame(
      page,
      async (id) => {
        const actor = game.actors.get(id);
        await actor?.sheet.close();
        await actor?.delete();
      },
      fixture.actorId
    );
  }

  mainConsole.assertClean();
});
