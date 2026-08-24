/**
 * Session Fate Chip cap regression for RULE-006. Uses a monochrome pot so the
 * actor grant, overflow return, Marshal announcement draw, and final balance
 * are deterministic.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { collectConsoleErrors, inGame, joinAs } from "./helpers/foundry-session.mjs";

test("session draws cap inventory, award BP, return overflow, and roll back failures", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);
  await joinAs(page, "Gamemaster");

  const result = await inGame(page, async () => {
    const { FatePot, grantChips } = game.deadlandsClassic.chips;
    const originalPot = FatePot.getData();
    const actor = await Actor.implementation.create({
      name: "E2E Session Chip Cap",
      type: "cowboy",
      system: {
        chips: { white: 8, red: 0, blue: 0, legend: 0 },
        bounty: 0,
      },
    });
    let messageId;

    try {
      // Six blue chips: actor draws three, keeps two, returns one; Marshal
      // then draws three, leaving the returned overflow as one chip in pot.
      await FatePot.patch({ white: 0, red: 0, blue: 6, legend: 0 });
      await FatePot.drawForSession({ chipsPerPlayer: 3, actors: [actor] });
      const message = game.messages.contents.at(-1);
      messageId = message.id;
      const afterSession = {
        chips: actor.system.chips.toObject
          ? actor.system.chips.toObject()
          : foundry.utils.deepClone(actor.system.chips),
        bounty: actor.system.bounty,
        pot: FatePot.getData(),
        chat: message.content,
      };

      const potBeforeExternal = FatePot.getData();
      const external = await grantChips(actor, ["legend"], { source: "external" });
      const externalPotUnchanged =
        JSON.stringify(potBeforeExternal) === JSON.stringify(FatePot.getData());

      // Simulate a document-write rejection after a real three-chip pot draw.
      await FatePot.patch({ white: 0, red: 3, blue: 0, legend: 0 });
      const failureDraw = await FatePot.drawBlind(3);
      const failingActor = {
        system: {
          chips: { white: 0, red: 0, blue: 0, legend: 0 },
          bounty: 0,
        },
        async update() {
          throw new Error("expected actor update failure");
        },
      };
      let failureMessage = null;
      try {
        await grantChips(failingActor, failureDraw, { source: "pot" });
      } catch (error) {
        failureMessage = error.message;
      }

      return {
        afterSession,
        external,
        externalPotUnchanged,
        bountyAfterExternal: actor.system.bounty,
        failureDraw,
        failureMessage,
        potAfterFailure: FatePot.getData(),
      };
    } finally {
      if (messageId) {
        await ChatMessage.deleteDocuments([messageId]);
      }
      await FatePot.patch(originalPot);
      await actor.delete();
    }
  });

  expect(result.afterSession.chips).toMatchObject({ white: 8, red: 0, blue: 2, legend: 0 });
  expect(result.afterSession.bounty).toBe(3);
  expect(result.afterSession.pot).toEqual({ white: 0, red: 0, blue: 1, legend: 0 });
  expect(result.afterSession.chat).toContain("kept blue, blue");
  expect(result.afterSession.chat).toContain("3 BP");
  expect(result.external).toEqual({ kept: [], converted: ["legend"], bpGained: 5 });
  expect(result.externalPotUnchanged).toBe(true);
  expect(result.bountyAfterExternal).toBe(8);
  expect(result.failureDraw).toEqual(["red", "red", "red"]);
  expect(result.failureMessage).toBe("expected actor update failure");
  expect(result.potAfterFailure).toEqual({ white: 0, red: 3, blue: 0, legend: 0 });
  consoleErrors.assertClean();
});
