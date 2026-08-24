/**
 * Arcana Action Deck regressions for RULE-005. The active-combat deck is
 * deterministic so each awaited draw and Legion's conditional Joker draw can
 * be counted exactly.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { collectConsoleErrors, inGame, joinAs } from "./helpers/foundry-session.mjs";

test("Shaman and Harrowed await active-combat draws without wasting cards", async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await joinAs(page, "Gamemaster");

  const result = await inGame(page, async () => {
    const shaman = await Actor.implementation.create({
      name: "E2E Shaman Deck Await",
      type: "shaman",
      system: {
        ritual: { level: 1, modifier: 0 },
        traits: {
          nimbleness: { dieCount: 1, dieType: "d6" },
          spirit: { dieCount: 1, dieType: "d6" },
        },
      },
    });
    const harrowed = await Actor.implementation.create({
      name: "E2E Harrowed Deck Await",
      type: "cowboy",
      system: { traits: { spirit: { dieCount: 1, dieType: "d6" } } },
    });
    const combat = await Combat.implementation.create({ active: true, round: 1 });
    const messageIds = [];
    const originalRandom = Math.random;
    const unhandledRejections = [];
    const onUnhandledRejection = (event) => {
      unhandledRejections.push(String(event.reason?.message ?? event.reason));
    };

    try {
      const [favor] = await shaman.createEmbeddedDocuments("Item", [
        {
          name: "E2E Favor",
          type: "favor",
          system: {
            ritualType: "dance",
            ritualTrait: "nimbleness",
            ritualTN: 5,
            appeasementCost: 1,
          },
        },
      ]);
      const drawPile = [
        { rank: null, suit: null, joker: "black" },
        { rank: "A", suit: "spades", joker: null },
        { rank: "K", suit: "hearts", joker: null },
        { rank: null, suit: null, joker: "red" },
        { rank: "A", suit: "spades", joker: null },
      ];
      await combat.setFlag("deadlands-classic", "deckState", {
        drawPile,
        discardPile: [],
        reshuffleAtRoundEnd: false,
      });

      const remaining = () =>
        game.deadlandsClassic.cards.ActionDeck.getState(combat).drawPile.length;
      const counts = { initial: remaining() };
      globalThis.addEventListener("unhandledrejection", onUnhandledRejection);

      // One die showing 1 busts. The awaited Joker maps to Spirit 20, which
      // attacks with 3d6 + four raise dice; zero RNG makes the damage exactly 7.
      Math.random = () => 0;
      const shamanMechanics = await import(
        "/systems/deadlands-classic/module/archetypes/shaman/mechanics.mjs"
      );
      await shamanMechanics.performRitual(shaman, favor);
      counts.afterShaman = remaining();
      const ritualMessage = game.messages.contents.at(-1);
      messageIds.push(ritualMessage.id);

      Math.random = () => 0.5;
      const mechanics = game.deadlandsClassic.overlays.get("harrowed").mechanics;
      await mechanics.activateHarrowed(harrowed);
      counts.afterActivation = remaining();
      const activatedSpirit = harrowed.system.harrowed.dominion.manitouSpirit.toObject
        ? harrowed.system.harrowed.dominion.manitouSpirit.toObject()
        : foundry.utils.deepClone(harrowed.system.harrowed.dominion.manitouSpirit);

      await harrowed.update({
        "system.harrowed.dominion.manitouSpirit": {
          kind: "legion",
          dieCount: 1,
          dieType: "d6",
        },
      });
      await mechanics.dominionRoll(harrowed);
      counts.afterRegularLegion = remaining();
      messageIds.push(game.messages.contents.at(-1).id);

      await mechanics.dominionRoll(harrowed);
      counts.afterJokerLegion = remaining();
      messageIds.push(game.messages.contents.at(-1).id);

      return {
        counts,
        activatedSpirit,
        ritualContent: ritualMessage.content,
        isHarrowed: harrowed.system.harrowed.isHarrowed,
        unhandledRejections,
      };
    } finally {
      globalThis.removeEventListener("unhandledrejection", onUnhandledRejection);
      Math.random = originalRandom;
      if (messageIds.length) {
        await ChatMessage.deleteDocuments([...new Set(messageIds)]);
      }
      await combat.delete();
      await shaman.delete();
      await harrowed.delete();
    }
  });

  expect(result.counts).toEqual({
    initial: 5,
    afterShaman: 4,
    afterActivation: 3,
    afterRegularLegion: 2,
    afterJokerLegion: 0,
  });
  expect(result.ritualContent).toContain("Guts damage");
  expect(result.ritualContent).toContain(": 7");
  expect(result.isHarrowed).toBe(true);
  expect(result.activatedSpirit).toMatchObject({ kind: "normal", dieCount: 3, dieType: "d8" });
  expect(result.unhandledRejections).toEqual([]);
  consoleErrors.assertClean();
});
