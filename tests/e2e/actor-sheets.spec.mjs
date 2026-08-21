/**
 * Smoke: every registered actor type renders its sheet without leaking raw
 * DEADLANDS.* i18n keys into the DOM. Temporary actors are cleaned up.
 * Prerequisites: docs/testing-e2e.md.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { inGame, joinAs } from "./helpers/foundry-session.mjs";

test("each actor type renders its sheet without raw i18n keys", async ({ page }) => {
  await joinAs(page, "Gamemaster");

  const types = await inGame(page, () => Object.keys(CONFIG.Actor.dataModels));
  expect(types.length).toBeGreaterThan(0);

  for (const type of types) {
    const leaks = await page.evaluate(async (actorType) => {
      const actor = await Actor.implementation.create({
        name: `E2E ${actorType}`,
        type: actorType,
      });
      try {
        await actor.sheet.render(true);
        const text = actor.sheet.element?.innerText ?? "";
        await actor.sheet.close();
        return text.match(/DEADLANDS\.[\w.]+/g) ?? [];
      } finally {
        await actor.delete();
      }
    }, type);

    expect(leaks, `raw i18n keys on the "${type}" sheet`).toEqual([]);
  }
});
