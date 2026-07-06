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

import { KeyedAsyncQueue } from "../async-queue.mjs";
import { CHIP_COLORS, CHIP_LIMIT, FATE_POT_SEED } from "../config.mjs";
import { dispatchGmOp, registerGmOp } from "../gm-proxy.mjs";

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

/** @throws {Error} when `color` is not a known chip color */
function requireColor(color) {
  if (!CHIP_COLORS[color]) {
    throw new Error(`Unknown chip color "${color}".`);
  }
}

/** @throws {Error} when `n` is not a positive integer */
function requireCount(n) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Chip count must be a positive integer, got "${n}".`);
  }
}

/**
 * Apply one wire-protocol operation to a plain pot object. Pure — shared by
 * the GM-side query handler and unit tests. Throws on any malformed op so a
 * bad request from another client can never corrupt the pot.
 *
 * @param {{ white:number, red:number, blue:number, legend:number }} pot
 * @param {{ op:"patch", patch:object } | { op:"drawBlind", n:number } |
 *          { op:"returnToPool", color:string, n:number } |
 *          { op:"discard", color:string, n:number } | { op:"reset" }} op
 * @param {() => number} [rng] — injectable for deterministic tests
 * @returns {{ pot: {white:number,red:number,blue:number,legend:number}, drawn?: string[] }}
 */
export function applyFatePotOp(pot, op, rng = Math.random) {
  switch (op?.op) {
    case "patch": {
      const next = { ...pot };
      for (const [color, value] of Object.entries(op.patch ?? {})) {
        requireColor(color);
        if (!Number.isInteger(value)) {
          throw new Error(`Patch value for "${color}" must be an integer, got "${value}".`);
        }
        next[color] = Math.max(0, value);
      }
      return { pot: next };
    }
    case "drawBlind": {
      requireCount(op.n);
      const { drawn, remaining } = drawBlindPure(pot, op.n, rng);
      return { pot: remaining, drawn };
    }
    case "returnToPool": {
      requireColor(op.color);
      requireCount(op.n);
      return { pot: { ...pot, [op.color]: (pot[op.color] ?? 0) + op.n } };
    }
    case "discard": {
      requireColor(op.color);
      requireCount(op.n);
      return { pot: { ...pot, [op.color]: Math.max(0, (pot[op.color] ?? 0) - op.n) } };
    }
    case "reset":
      return { pot: { ...FATE_POT_SEED } };
    default:
      throw new Error(`Unknown Fate Pot op "${op?.op}".`);
  }
}

/**
 * Authorize a Fate Pot op by the requesting user's privilege. Runs on the GM
 * client before the op is applied, so a non-GM player can only request the
 * narrow set of writes a legitimate spend needs. `reset`/`patch` are the whole
 * pot's absolute state (GM only); a player's blind draw is the single-chip
 * Marshal's Tithe / Joker draw (n=1); returns/discards can never exceed the
 * per-actor chip cap. Malformed ops fall through and are rejected later by
 * {@link applyFatePotOp}.
 *
 * @param {{ op:string, n?:number }} op — wire-protocol op (opId already stripped)
 * @param {{ isGM: boolean }} context
 * @throws {Error} when a non-GM requests a GM-only or over-limit op
 */
export function assertFatePotOpAuthorized(op, { isGM }) {
  switch (op?.op) {
    case "reset":
    case "patch":
      if (!isGM) {
        throw new Error(`Only a GM may ${op.op} the Fate Pot.`);
      }
      return;
    case "drawBlind":
      if (!isGM && op.n > 1) {
        throw new Error("Only a GM may draw more than one chip from the pot at once.");
      }
      return;
    case "returnToPool":
    case "discard":
      if (!isGM && op.n > CHIP_LIMIT) {
        throw new Error(`Chip count exceeds the per-request limit (${CHIP_LIMIT}).`);
      }
      return;
    default:
      return;
  }
}

// ── FatePot class — Foundry-integrated ───────────────────────────────────────

const QUEUE_KEY = "pot";
const FATE_POT_OP = `${SYSTEM_ID}.fatePotOp`;

export class FatePot {
  // All mutations route through the active GM's client (dispatchGmOp), where
  // #executeOp serializes every read-modify-write in this queue — one writer
  // for the whole world, so neither same-client nor cross-client concurrent
  // spends can interleave and lose an update. See docs/notes.md.
  static #mutex = new KeyedAsyncQueue();

  static #enqueue(task) {
    return FatePot.#mutex.enqueue(QUEUE_KEY, task);
  }

  /** Register the world setting. Call from `init` hook. */
  static registerSetting(systemId = SYSTEM_ID) {
    game.settings.register(systemId, SETTING_KEY, {
      scope: "world",
      config: false,
      type: FatePotModel,
      default: { ...FATE_POT_SEED },
    });
  }

  /**
   * Register the GM-op query handler. Call from `init` hook on every client —
   * User#query refuses to send a query name the caller has not registered.
   */
  static registerQueries() {
    registerGmOp(FATE_POT_OP, (data, context) => FatePot.#executeOp(data, context));
  }

  /**
   * GM-side op executor — the single serialized writer for the pot.
   * @param {object} data — wire-protocol op (see applyFatePotOp)
   * @param {{ user: User }} context — the requesting user
   * @returns {Promise<{ pot: object, drawn?: string[] }>}
   */
  static async #executeOp(data, { user }) {
    if (!game.user.isGM) {
      throw new Error("Fate Pot ops must execute on a GM client.");
    }
    assertFatePotOpAuthorized(data, { isGM: Boolean(user?.isGM) });
    return FatePot.#enqueue(async () => {
      const { pot, drawn } = applyFatePotOp(FatePot.getData(), data);
      await game.settings.set(SYSTEM_ID, SETTING_KEY, pot);
      return drawn === undefined ? { pot } : { pot, drawn };
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

  /**
   * Overwrite pot counts with the given absolute values (clamped ≥ 0), routed
   * through the GM client like every other mutation.
   *
   * Updater functions are no longer accepted — they can't cross the GM query
   * wire. Increments/decrements go through the dedicated ops instead
   * (`returnToPool`, `discard`, `drawBlind`).
   *
   * @param {{ white?:number, red?:number, blue?:number, legend?:number }} patch
   */
  static async patch(patch) {
    if (typeof patch === "function") {
      throw new TypeError(
        "FatePot.patch no longer accepts updater functions — use returnToPool/discard/drawBlind or pass a plain patch object."
      );
    }
    await dispatchGmOp(FATE_POT_OP, { op: "patch", patch });
  }

  /**
   * Reset pot to starting seed. dlc p.146. GM only (enforced on the GM side).
   */
  static async reset() {
    await dispatchGmOp(FATE_POT_OP, { op: "reset" });
  }

  /**
   * Draw n chips blind at random from the pot. dlc p.146.
   * Randomness runs on the GM client; deterministic tests use
   * `applyFatePotOp` / `drawBlindPure` directly.
   * @param {number} n
   * @returns {Promise<string[]>} colors drawn
   */
  static async drawBlind(n) {
    const { drawn } = await dispatchGmOp(FATE_POT_OP, { op: "drawBlind", n });
    return drawn;
  }

  /**
   * Return chips to the pot (all non-Legend-Reroll spends). dlc p.26.
   * @param {string} color
   * @param {number} [n=1]
   */
  static async returnToPool(color, n = 1) {
    await dispatchGmOp(FATE_POT_OP, { op: "returnToPool", color, n });
  }

  /**
   * Permanently remove chips (Legend Reroll only). dlc p.148.
   * @param {string} color
   * @param {number} [n=1]
   */
  static async discard(color, n = 1) {
    await dispatchGmOp(FATE_POT_OP, { op: "discard", color, n });
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
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    });
  }
}
