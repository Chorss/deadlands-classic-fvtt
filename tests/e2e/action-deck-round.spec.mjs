/**
 * Action Deck round-boundary regression: a sleeved card survives nextRound,
 * while only the active hand is retired to the discard pile. A Black Joker
 * still removes the sleeve explicitly. `dlc` p.117-118.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { collectConsoleErrors, inGame, joinAs } from "./helpers/foundry-session.mjs";

test("nextRound preserves the sleeve and Black Joker removes it", async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await joinAs(page, "Gamemaster");

  const result = await inGame(page, async () => {
    const actor = await Actor.implementation.create({ name: "E2E Sleeve", type: "cowboy" });
    const combat = await Combat.implementation.create({ round: 1 });
    try {
      const [combatant] = await combat.createEmbeddedDocuments("Combatant", [
        { actorId: actor.id, name: actor.name },
      ]);
      const roundCards = [
        { rank: "A", suit: "spades", joker: null },
        { rank: "9", suit: "hearts", joker: null },
      ];
      const sleeve = { rank: "K", suit: "diamonds", joker: null };

      await combatant.setHand(roundCards);
      await combatant.setFlag("deadlands-classic", "sleevedCard", sleeve);
      await game.deadlandsClassic.cards.ActionDeck.initialize(combat);

      await combat.nextRound();
      const state = game.deadlandsClassic.cards.ActionDeck.getState(combat);
      const afterRound = {
        hand: combatant.hand,
        sleeve: combatant.sleevedCard,
        initiative: combatant.initiative,
        discarded: state.discardPile,
      };

      await combat._applyBlackJoker(combatant);
      return { afterRound, afterBlackJoker: combatant.sleevedCard };
    } finally {
      await combat.delete();
      await actor.delete();
    }
  });

  expect(result.afterRound.hand).toEqual([]);
  expect(result.afterRound.sleeve).toEqual({ rank: "K", suit: "diamonds", joker: null });
  expect(result.afterRound.initiative).toBeNull();
  expect(result.afterRound.discarded).toEqual([
    { rank: "A", suit: "spades", joker: null },
    { rank: "9", suit: "hearts", joker: null },
  ]);
  expect(result.afterBlackJoker).toBeNull();
  consoleErrors.assertClean();
});
