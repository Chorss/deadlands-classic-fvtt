/**
 * Deadlands Classic — Community Edition
 * Entry point. Wiring for dice, cards, chips, wounds and archetypes is added
 * in later phases via the registries declared in `module/core/`.
 *
 * @see https://github.com/Chorss/deadlands-classic-fvtt
 * @license MIT
 */

const SYSTEM_ID = "deadlands-classic";
const LOG_PREFIX = `${SYSTEM_ID} |`;

Hooks.once("init", () => {
  console.log(`${LOG_PREFIX} Initializing`);
  game.deadlandsClassic = { id: SYSTEM_ID };
});

Hooks.once("ready", () => {
  console.log(`${LOG_PREFIX} ${game.i18n.localize("DEADLANDS.System.Loaded")}`);
});
