/**
 * Negative Wind regression for RULE-004. A failed Guts check crosses exactly
 * one threshold through the shared Wind transaction, persists the resulting
 * upper-guts wound, and renders the negative value in the editable sheet.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { collectConsoleErrors, inGame, joinAs } from "./helpers/foundry-session.mjs";

test("Guts loss persists negative Wind and its canonical guts wound", async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await joinAs(page, "Gamemaster");

  const result = await inGame(page, async () => {
    const actor = await Actor.implementation.create({
      name: "E2E Negative Wind",
      type: "cowboy",
      system: {
        traits: {
          spirit: {
            dieCount: 1,
            dieType: "d6",
            aptitudes: { guts: { level: 1, modifier: 0 } },
          },
        },
      },
    });
    let messageId;
    try {
      await actor.update({
        "system.wind.value": -11,
        "system.wounds.upperGuts.severity": 0,
      });

      // Guts die 1 = failure; Scart d6 aces 6+1 = Willies (1 Wind die);
      // Wind die 1 moves -11 to the first -12 threshold.
      const rolls = [0, 0.999, 0, 0];
      let rollIndex = 0;
      const guts = await game.deadlandsClassic.dice.rollGutsCheck(actor, {
        tn: 3,
        _rng: () => rolls[rollIndex++],
      });
      messageId = game.messages.contents.at(-1).id;

      await actor.sheet.render(true);
      const input = actor.sheet.element.querySelector('[name="system.wind.value"]');
      const rendered = {
        value: input?.value ?? null,
        hasMinimum: input?.hasAttribute("min") ?? null,
        header: actor.sheet.element.querySelector(".dlc-sheet-header .dlc-wind")?.textContent ?? "",
      };

      return {
        success: guts.success,
        windLost: guts.windLost,
        wind: actor.system.wind.value,
        upperGuts: actor.system.wounds.upperGuts.severity,
        rendered,
      };
    } finally {
      await actor.sheet.close();
      if (messageId) {
        await ChatMessage.deleteDocuments([messageId]);
      }
      await actor.delete();
    }
  });

  expect(result.success).toBe(false);
  expect(result.windLost).toBe(1);
  expect(result.wind).toBe(-12);
  expect(result.upperGuts).toBe(1);
  expect(result.rendered.value).toBe("-12");
  expect(result.rendered.hasMinimum).toBe(false);
  expect(result.rendered.header).toContain("-12");
  consoleErrors.assertClean();
});
