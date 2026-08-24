/**
 * Regression for the GM-proxy (module/core/gm-proxy.mjs): two genuinely
 * different clients (GM + player, separate browser contexts = separate
 * sockets) hammer the Fate Pot and the Action Deck concurrently. Before the
 * GM-routed serialized writes, this scenario lost chip updates and dealt
 * duplicate cards; player-side writes were also rejected by server
 * permissions outright.
 *
 * Prerequisites (docs/testing-e2e.md): world `deadlands-test` with
 * passwordless users "Gamemaster" and "Player".
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { ensurePasswordlessPlayer, joinAs } from "./helpers/foundry-session.mjs";

const OPS_PER_CLIENT = 5;
const CARDS_PER_CLIENT = 5;
const FULL_DECK = 54;

/** Fire N sequential-per-call, concurrent-in-flight white-chip returns. */
const returnWhites = async (n) => {
  const { FatePot } = game.deadlandsClassic.chips;
  await Promise.all(Array.from({ length: n }, () => FatePot.returnToPool("white", 1)));
};

test("concurrent GM + player writes neither lose chips nor duplicate cards", async ({
  browser,
}) => {
  // Own the contexts so they can be closed — otherwise each spec leaks two live
  // Foundry sessions into every later spec sharing this worker.
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  try {
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();
    await joinAs(gmPage, "Gamemaster");
    await ensurePasswordlessPlayer(gmPage, "Player");
    await joinAs(playerPage, "Player");

    // ── Fate Pot: concurrent returnToPool from both clients ────────────────
    const whiteBefore = await gmPage.evaluate(
      () => game.deadlandsClassic.chips.FatePot.getData().white
    );

    await Promise.all([
      gmPage.evaluate(returnWhites, OPS_PER_CLIENT),
      playerPage.evaluate(returnWhites, OPS_PER_CLIENT),
    ]);

    // All writes happen on the GM client, so its read is authoritative.
    const whiteAfter = await gmPage.evaluate(
      () => game.deadlandsClassic.chips.FatePot.getData().white
    );
    expect(whiteAfter, "lost white-chip updates across clients").toBe(
      whiteBefore + 2 * OPS_PER_CLIENT
    );

    // Restore the pot.
    await gmPage.evaluate(
      (white) => game.deadlandsClassic.chips.FatePot.patch({ white }),
      whiteBefore
    );

    // ── Action Deck: concurrent deals from both clients ────────────────────
    const combatId = await gmPage.evaluate(async () => {
      const combat = await Combat.implementation.create({});
      return combat.id;
    });

    try {
      // Wait for the new combat to replicate to the player client.
      await playerPage.waitForFunction((id) => Boolean(game.combats.get(id)), combatId);

      const dealFromCombat = async ({ id, count }) =>
        game.deadlandsClassic.cards.ActionDeck.deal(game.combats.get(id), count);

      const [gmCards, playerCards] = await Promise.all([
        gmPage.evaluate(dealFromCombat, { id: combatId, count: CARDS_PER_CLIENT }),
        playerPage.evaluate(dealFromCombat, { id: combatId, count: CARDS_PER_CLIENT }),
      ]);

      const all = [...gmCards, ...playerCards].map((card) => JSON.stringify(card));
      expect(new Set(all).size, "duplicate cards dealt across clients").toBe(2 * CARDS_PER_CLIENT);

      const remaining = await gmPage.evaluate(
        (id) =>
          game.deadlandsClassic.cards.ActionDeck.getState(game.combats.get(id)).drawPile.length,
        combatId
      );
      expect(remaining).toBe(FULL_DECK - 2 * CARDS_PER_CLIENT);
    } finally {
      await gmPage.evaluate((id) => game.combats.get(id)?.delete(), combatId);
    }
  } finally {
    await Promise.all([gmContext.close(), playerContext.close()]);
  }
});
