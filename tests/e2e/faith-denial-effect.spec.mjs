/**
 * Active Effects V2: a sin creates one timed faith-denial effect, and native
 * world-time expiry restores access to miracles.
 *
 * @license MIT
 */

import { expect, test } from "@playwright/test";
import { collectConsoleErrors, inGame, joinAs } from "./helpers/foundry-session.mjs";

test("faith denial is a native timed Active Effect which restores miracle access", async ({
  page,
}) => {
  const consoleErrors = collectConsoleErrors(page);
  await joinAs(page, "Gamemaster");

  const fixture = await inGame(page, async () => {
    const actor = await Actor.implementation.create({ name: "E2E Faith Denial", type: "blessed" });
    const [miracle] = await actor.createEmbeddedDocuments("Item", [
      { name: "E2E Miracle", type: "miracle", system: { tn: 5 } },
    ]);
    const mechanics = await import(
      "/systems/deadlands-classic/module/archetypes/blessed/mechanics.mjs"
    );
    await mechanics.trackSin(actor, "minor");
    const effect = actor.effects.find(
      (candidate) => candidate.flags?.["deadlands-classic"]?.faithDenial
    );
    return {
      actorId: actor.id,
      effectId: effect?.id,
      miracleId: miracle.id,
      originalWorldTime: game.time.worldTime,
      seconds: mechanics.SIN_DENIAL_SECONDS.minor,
    };
  });

  try {
    const initial = await inGame(
      page,
      async ({ actorId, effectId }) => {
        const actor = game.actors.get(actorId);
        const effect = actor.effects.get(effectId);
        const mechanics = await import(
          "/systems/deadlands-classic/module/archetypes/blessed/mechanics.mjs"
        );
        return {
          denied: mechanics.isMiracleAccessDenied(actor),
          expiry: effect.duration.expiry,
          severity: effect.flags["deadlands-classic"].faithDenial.severity,
          changes: effect.system.changes,
        };
      },
      fixture
    );
    expect(initial).toEqual({ denied: true, expiry: null, severity: "minor", changes: [] });

    await inGame(page, ({ seconds }) => game.time.advance(seconds + 1), fixture);
    await page.waitForFunction(
      ({ actorId, effectId }) => game.actors.get(actorId)?.effects.get(effectId)?.duration.expired,
      fixture
    );

    const restored = await inGame(
      page,
      async ({ actorId }) => {
        const actor = game.actors.get(actorId);
        const mechanics = await import(
          "/systems/deadlands-classic/module/archetypes/blessed/mechanics.mjs"
        );
        return mechanics.isMiracleAccessDenied(actor);
      },
      fixture
    );
    expect(restored).toBe(false);
  } finally {
    await inGame(
      page,
      async ({ actorId, originalWorldTime }) => {
        await game.settings.set("core", "time", originalWorldTime);
        await game.actors.get(actorId)?.delete();
      },
      fixture
    );
  }

  consoleErrors.assertClean();
});
