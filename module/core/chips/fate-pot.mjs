/**
 * Fate Pot — world-level fungible chip counter.
 *
 * Stored as a single world setting (scope: "world", config: false) holding
 * four integers `{white, red, blue, legend}`. NOT a Cards document — chips are
 * fungible counters, not unique cards. Decision D2 confirmed in plan §3.3.
 *
 * Mechanics verified against dlc p.26, p.146-148:
 *   - Session start: 3 chips drawn blind per player + 3 for Marshal. dlc p.146.
 *   - Spent chips return to pot. dlc p.26. Exception: Legend Reroll → discard. p.148.
 *   - Red chip on trait/aptitude: Marshal draws 1 from pot (Tithe). dlc p.148.
 *   - Starting seed: 50W / 25R / 10B / 0L. dlc p.146.
 *
 * Pure logic (no DOM) — testable without Foundry via the static helpers that
 * accept a plain `potData` object (see chip-rules.test.mjs, Phase 5).
 *
 * @license MIT
 */

import { CHIP_COLORS, FATE_POT_SEED } from "../config.mjs";

const SYSTEM_ID = "deadlands-classic";
const SETTING_KEY = "fatePot";

// ── DataModel for the world setting ──────────────────────────────────────────

/**
 * Typed container for the Fate Pot; registered as the setting `type`.
 * V14: game.settings.register accepts a DataModel subclass as `type`.
 *
 * Guarded so this module can be imported in node:test without a Foundry runtime.
 */
export const FatePotModel = globalThis.foundry
  ? class FatePotModel extends foundry.abstract.DataModel {
      static defineSchema() {
        const f = foundry.data.fields;
        return {
          white: new f.NumberField({ integer: true, min: 0, initial: FATE_POT_SEED.white }),
          red: new f.NumberField({ integer: true, min: 0, initial: FATE_POT_SEED.red }),
          blue: new f.NumberField({ integer: true, min: 0, initial: FATE_POT_SEED.blue }),
          legend: new f.NumberField({ integer: true, min: 0, initial: FATE_POT_SEED.legend }),
        };
      }
    }
  : class FatePotModel {}; // stub — unused outside Foundry runtime

// ── Pure logic helpers (no Foundry runtime needed) ────────────────────────────

/**
 * Build a weighted array for blind draw and pick n items from it.
 * @param {{ white:number, red:number, blue:number, legend:number }} pot
 * @param {number} n
 * @param {() => number} [rng]
 * @returns {{ drawn: string[], remaining: {white:number,red:number,blue:number,legend:number} }}
 */
export function drawBlindPure(pot, n, rng = Math.random) {
  const pool = [];
  for (const [color, count] of Object.entries(pot)) {
    for (let i = 0; i < count; i++) {
      pool.push(color);
    }
  }

  const drawn = [];
  const remaining = { ...pot };
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const color = pool.splice(idx, 1)[0];
    drawn.push(color);
    remaining[color]--;
  }
  return { drawn, remaining };
}

// ── FatePot class — Foundry-integrated ───────────────────────────────────────

export class FatePot {
  /** Register the world setting. Call from `init` hook. */
  static registerSetting(systemId = SYSTEM_ID) {
    game.settings.register(systemId, SETTING_KEY, {
      scope: "world",
      config: false,
      type: FatePotModel,
      default: { ...FATE_POT_SEED },
    });
  }

  /** @returns {FatePotModel} current pot */
  static get() {
    return game.settings.get(SYSTEM_ID, SETTING_KEY);
  }

  /** @returns {{ white:number, red:number, blue:number, legend:number }} plain data */
  static getData() {
    const pot = FatePot.get();
    return { white: pot.white, red: pot.red, blue: pot.blue, legend: pot.legend };
  }

  /** @param {{ white?:number, red?:number, blue?:number, legend?:number }} patch */
  static async patch(patch) {
    const current = FatePot.getData();
    await game.settings.set(SYSTEM_ID, SETTING_KEY, { ...current, ...patch });
  }

  /**
   * Reset pot to starting seed. dlc p.146.
   * Only the GM should call this (start-of-campaign / reset).
   */
  static async reset() {
    await game.settings.set(SYSTEM_ID, SETTING_KEY, { ...FATE_POT_SEED });
  }

  /**
   * Draw n chips blind at random from the pot. dlc p.146.
   * @param {number} n
   * @param {() => number} [_rng] injectable for tests
   * @returns {Promise<string[]>} colors drawn
   */
  static async drawBlind(n, _rng = Math.random) {
    const { drawn, remaining } = drawBlindPure(FatePot.getData(), n, _rng);
    await FatePot.patch(remaining);
    return drawn;
  }

  /**
   * Return chips to the pot (all non-Legend-Reroll spends). dlc p.26.
   * @param {string} color
   * @param {number} [n=1]
   */
  static async returnToPool(color, n = 1) {
    const current = FatePot.getData();
    await FatePot.patch({ [color]: (current[color] ?? 0) + n });
  }

  /**
   * Permanently remove chips (Legend Reroll only). dlc p.148.
   * @param {string} color
   * @param {number} [n=1]
   */
  static async discard(color, n = 1) {
    const current = FatePot.getData();
    await FatePot.patch({ [color]: Math.max(0, (current[color] ?? 0) - n) });
  }

  /**
   * Marshal's Tithe: draw 1 chip from pot for Marshal use. dlc p.148.
   * Called when a player spends a Red chip on a trait/aptitude roll.
   * @returns {Promise<string|null>} color drawn, or null if pot empty
   */
  static async marshalTithe() {
    const drawn = await FatePot.drawBlind(1);
    return drawn[0] ?? null;
  }

  /**
   * Session start: deal `chipsPerPlayer` chips to every eligible actor,
   * plus `chipsPerPlayer` for the Marshal (stored as a chat notification).
   * dlc p.146.
   *
   * @param {object} [opts]
   * @param {number} [opts.chipsPerPlayer=3]
   * @param {Actor[]} [opts.actors]  defaults to all player-owned PCs in the world
   */
  static async drawForSession({ chipsPerPlayer = 3, actors } = {}) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("DEADLANDS.Chip.GMOnly"));
      return;
    }

    const pcs =
      actors ??
      game.actors.filter(
        (a) => a.hasPlayerOwner && Object.keys(CHIP_COLORS).some((c) => c in (a.system.chips ?? {}))
      );

    const log = [];
    for (const actor of pcs) {
      const drawn = await FatePot.drawBlind(chipsPerPlayer);
      const delta = {};
      for (const color of drawn) {
        delta[`system.chips.${color}`] = (actor.system.chips[color] ?? 0) + 1;
      }
      await actor.update(delta);
      log.push(`${actor.name}: ${drawn.join(", ")}`);
    }

    // Marshal draws too. dlc p.146.
    const marshalDraw = await FatePot.drawBlind(chipsPerPlayer);
    log.push(`Marshal: ${marshalDraw.join(", ")}`);

    await ChatMessage.create({
      content: `<div class="dlc-chip-draw"><strong>${game.i18n.localize("DEADLANDS.Chip.SessionDraw")}</strong><ul>${log.map((l) => `<li>${l}</li>`).join("")}</ul></div>`,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }
}
