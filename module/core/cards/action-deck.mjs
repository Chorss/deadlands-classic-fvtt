/**
 * ActionDeck — card-based initiative engine for Deadlands Classic.
 *
 * Pure helpers (cardValue, buildFullDeck, etc.) are dependency-free and unit-tested.
 * The ActionDeck class stores deck state on the Combat document flag so it persists
 * across scene reloads without a standalone Cards document.
 *
 * Bridge design: Foundry's Cards API has no native link to Combatant#initiative
 * (deal/pass/draw work only between Cards documents). We encode the highest drawn
 * card as a numeric initiative value so Foundry's descending-sort order maps to
 * the Deadlands rule that the highest card acts first. `dlc` p.116-118
 * (initiative chapter).
 *
 * @see docs/implementation-plan.md §3.2
 * @license MIT
 */

import { KeyedAsyncQueue } from "../async-queue.mjs";
import { DEADLANDS } from "../config.mjs";
import { dispatchGmOp, registerGmOp } from "../gm-proxy.mjs";

// ── Pure helpers (no Foundry dependency — safe to call from unit tests) ──────

/**
 * Rank → numeric value. Ace is high (14). Built from DEADLANDS.CARD_RANKS.
 * @type {Record<string, number>}
 */
const RANK_NUMS = (() => {
  const map = {};
  DEADLANDS.CARD_RANKS.forEach((r, i) => {
    map[r] = i + 2; // "2"→2, "3"→3, …, "A"→14
  });
  return map;
})();

/**
 * Encode a card as a numeric initiative value (higher = acts first).
 *
 * Encoding: rank × 10 + suit_precedence
 *   Red Joker  → 999  (acts at any time, dlc p.118)
 *   Black Joker→ 998  (penalty card, removed from hand, dlc p.118)
 *   Ace ♠      → 144, Ace ♥ → 143, …, 2 ♣ → 21
 *
 * @param {{ rank: string|null, suit: string|null, joker: string|null }} card
 * @returns {number}
 */
export function cardValue(card) {
  if (card.joker === "red") {
    return 999;
  }
  if (card.joker === "black") {
    return 998;
  }
  const rank = RANK_NUMS[card.rank] ?? 0;
  const suit = DEADLANDS.CARD_SUITS[card.suit]?.precedence ?? 0;
  return rank * 10 + suit;
}

/**
 * Descending comparator for sorting hands (highest initiative first). `dlc` p.116.
 * @param {{ rank: string|null, suit: string|null, joker: string|null }} a
 * @param {{ rank: string|null, suit: string|null, joker: string|null }} b
 * @returns {number}
 */
export function compareCards(a, b) {
  return cardValue(b) - cardValue(a);
}

/**
 * Human-readable card label. No i18n dependency — safe for unit tests and logging.
 * Localized labels go through `DEADLANDS.Combat.Card.*` i18n keys at the UI layer.
 * @param {{ rank: string|null, suit: string|null, joker: string|null }} card
 * @returns {string}
 */
export function cardLabelRaw(card) {
  if (card.joker === "red") {
    return "Red Joker";
  }
  if (card.joker === "black") {
    return "Black Joker";
  }
  const suit = card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
  return `${card.rank} of ${suit}`;
}

/**
 * Build a full unshuffled 54-card deck (4 suits × 13 ranks + Red + Black Joker).
 * Suit order matches DEADLANDS.CARD_SUITS insertion order; ranks descend (A first).
 * @returns {Array<{ rank: string|null, suit: string|null, joker: string|null }>}
 */
export function buildFullDeck() {
  const cards = [];
  for (const suit of Object.keys(DEADLANDS.CARD_SUITS)) {
    for (const rank of [...DEADLANDS.CARD_RANKS].reverse()) {
      cards.push({ rank, suit, joker: null });
    }
  }
  cards.push({ rank: null, suit: null, joker: "red" });
  cards.push({ rank: null, suit: null, joker: "black" });
  return cards;
}

/**
 * Fisher-Yates in-place shuffle. Returns a new array; does not mutate the input.
 * @template T
 * @param {T[]} cards
 * @param {() => number} [rng] — injectable for deterministic testing
 * @returns {T[]}
 */
export function shuffleDeck(cards, rng = Math.random) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Cards to deal based on a Quickness roll result.
 * `dlc` p.116: bust → 0; failure → 1 base card; success → a second
 * card; each raise adds one more, capped at MAX_ACTION_CARDS.
 *
 * @param {{ bust: boolean, success: boolean, raises: number }} rollResult
 * @returns {number}
 */
export function quicknessCardCount({ bust, success, raises }) {
  if (bust) {
    return 0;
  }
  return Math.min(DEADLANDS.MAX_ACTION_CARDS, 1 + Number(Boolean(success)) + raises);
}

/**
 * Resolve a Joker's Fate-Chip side effect based on who drew it. `dlc` p.118:
 * the chip draw is posse-only for both Jokers. A Red Joker drawn by a player
 * grants that character a chip, but the Marshal's own NPC drawing it grants
 * nothing. A Black Joker drawn by a player makes the Marshal draw a chip, but
 * the Marshal's own NPC drawing it grants the posse nothing. The sleeve
 * discard + round-end reshuffle of a Black Joker happen regardless of side.
 *
 * @param {"red"|"black"} joker
 * @param {boolean} isPosseDraw — true if a player-owned actor drew the Joker
 * @returns {{ drawsChip: boolean, messageKey: string }}
 */
export function resolveJokerOutcome(joker, isPosseDraw) {
  if (joker === "red") {
    return isPosseDraw
      ? { drawsChip: true, messageKey: "DEADLANDS.Combat.Initiative.RedJoker" }
      : { drawsChip: false, messageKey: "DEADLANDS.Combat.Initiative.RedJokerNPC" };
  }
  return isPosseDraw
    ? { drawsChip: true, messageKey: "DEADLANDS.Combat.Initiative.BlackJoker" }
    : { drawsChip: false, messageKey: "DEADLANDS.Combat.Initiative.BlackJokerNPC" };
}

// ── World-state (Foundry-dependent) ─────────────────────────────────────────

const FLAG_SCOPE = "deadlands-classic";
const FLAG_KEY = "deckState";
const ACTION_DECK_OP = `${FLAG_SCOPE}.actionDeckOp`;

/**
 * @typedef {{ drawPile: object[], discardPile: object[], reshuffleAtRoundEnd: boolean }} DeckState
 */

/** @returns {DeckState} a fresh shuffled 54-card deck state */
function freshDeckState(rng) {
  return {
    drawPile: shuffleDeck(buildFullDeck(), rng),
    discardPile: [],
    reshuffleAtRoundEnd: false,
  };
}

/**
 * Deal `count` cards, recycling this deck's discard pile into the draw stock if
 * the draw pile runs short (never a fresh second deck — that would deal a
 * duplicate of a card already in play). `dlc` p.116.
 * @param {DeckState} base
 * @param {number} count
 * @param {() => number} rng
 * @returns {{ state: DeckState, result: { ok:true, dealt:object[], cardsRemaining:number } }}
 */
function dealFromDeck(base, count, rng) {
  const drawPile = [...base.drawPile];
  let discardPile = [...(base.discardPile ?? [])];
  if (drawPile.length < count && discardPile.length > 0) {
    drawPile.push(...shuffleDeck(discardPile, rng));
    discardPile = [];
  }
  const dealt = drawPile.splice(0, count);
  return {
    state: { ...base, drawPile, discardPile },
    result: { ok: true, dealt, cardsRemaining: drawPile.length },
  };
}

/**
 * Apply one wire-protocol operation to a deck state. Pure — shared by the
 * GM-side query handler and unit tests. Returns the (possibly unchanged)
 * state plus a JSON-safe result that never exposes the draw-pile order.
 *
 * @param {DeckState|null} state — current state, or null when uninitialized
 * @param {{ op:"initialize" } | { op:"deal", count:number } |
 *          { op:"discard", cards:object[] } |
 *          { op:"markReshuffle" } | { op:"maybeReshuffle" }} op
 * @param {() => number} [rng] — injectable for deterministic tests
 * @returns {{ state: DeckState|null,
 *             result: { ok:true, dealt?:object[], reshuffled?:boolean, cardsRemaining:number } }}
 */
export function applyDeckOp(state, op, rng = Math.random) {
  switch (op?.op) {
    case "initialize": {
      const next = state ?? freshDeckState(rng);
      return { state: next, result: { ok: true, cardsRemaining: next.drawPile.length } };
    }
    case "deal": {
      if (!Number.isInteger(op.count) || op.count <= 0) {
        throw new Error(`Deal count must be a positive integer, got "${op.count}".`);
      }
      return dealFromDeck(state ?? freshDeckState(rng), op.count, rng);
    }
    case "discard": {
      // Retire played cards to the discard pile so a later mid-round
      // exhaustion can recycle them. `dlc` p.116.
      const base = state ?? freshDeckState(rng);
      const cards = Array.isArray(op.cards) ? op.cards : [];
      const next = { ...base, discardPile: [...(base.discardPile ?? []), ...cards] };
      return { state: next, result: { ok: true, cardsRemaining: next.drawPile.length } };
    }
    case "markReshuffle": {
      const base = state ?? freshDeckState(rng);
      const next = { ...base, reshuffleAtRoundEnd: true };
      return { state: next, result: { ok: true, cardsRemaining: next.drawPile.length } };
    }
    case "maybeReshuffle": {
      if (!state?.reshuffleAtRoundEnd) {
        return {
          state,
          result: { ok: true, reshuffled: false, cardsRemaining: state?.drawPile.length ?? 0 },
        };
      }
      const next = freshDeckState(rng);
      return {
        state: next,
        result: { ok: true, reshuffled: true, cardsRemaining: next.drawPile.length },
      };
    }
    default:
      throw new Error(`Unknown Action Deck op "${op?.op}".`);
  }
}

/**
 * Manages the Action Deck as a flag on the active Combat document.
 * Avoids the native Cards API, which has no bridge to Combatant#initiative.
 */
export class ActionDeck {
  // All mutations route through the active GM's client (dispatchGmOp), where
  // #executeOp serializes every read-modify-write in this queue, keyed per
  // combat id — one writer for the whole world, so neither same-client nor
  // cross-client concurrent deals can interleave and duplicate or lose cards.
  // See docs/notes.md and the equivalent note on FatePot.
  static #mutex = new KeyedAsyncQueue();

  static #enqueue(combat, task) {
    return ActionDeck.#mutex.enqueue(combat.id, task);
  }

  /**
   * Register the GM-op query handler. Call from `init` hook on every client —
   * User#query refuses to send a query name the caller has not registered.
   */
  static registerQueries() {
    registerGmOp(ACTION_DECK_OP, (data, context) => ActionDeck.#executeOp(data, context));
  }

  /**
   * GM-side op executor — the single serialized writer for a combat's deck.
   * @param {object} data — wire-protocol op plus `combatId` (see applyDeckOp)
   * @param {{ user: User }} _context — the requesting user (unused; every op
   *   is available to players — deals are triggered by their own casting flows)
   * @returns {Promise<{ ok:true, dealt?:object[], reshuffled?:boolean, cardsRemaining:number }>}
   */
  static async #executeOp(data, _context) {
    if (!game.user.isGM) {
      throw new Error("Action Deck ops must execute on a GM client.");
    }
    const combat = game.combats.get(data?.combatId);
    if (!combat) {
      throw new Error(`Combat "${data?.combatId}" not found.`);
    }
    return ActionDeck.#enqueue(combat, async () => {
      const current = ActionDeck.getState(combat);
      const { state, result } = applyDeckOp(current, data);
      if (state !== current) {
        await combat.setFlag(FLAG_SCOPE, FLAG_KEY, state);
      }
      return result;
    });
  }

  /**
   * @param {Combat} combat
   * @returns {DeckState|null}
   */
  static getState(combat) {
    return combat.getFlag(FLAG_SCOPE, FLAG_KEY) ?? null;
  }

  /**
   * Create a fresh shuffled deck on the combat if none exists.
   * @param {Combat} combat
   * @returns {Promise<{ ok:true, cardsRemaining:number }>} summary (never the pile itself)
   */
  static async initialize(combat) {
    return dispatchGmOp(ACTION_DECK_OP, { op: "initialize", combatId: combat.id });
  }

  /**
   * Draw `count` cards from the pile. If the pile runs short mid-round it
   * recycles this deck's discard pile back into the draw stock (never a fresh
   * second deck). `dlc` p.116.
   * @param {Combat} combat
   * @param {number} count
   * @returns {Promise<object[]>} dealt cards
   */
  static async deal(combat, count) {
    if (count <= 0) {
      return [];
    }
    const { dealt } = await dispatchGmOp(ACTION_DECK_OP, {
      op: "deal",
      combatId: combat.id,
      count,
    });
    return dealt;
  }

  /**
   * Retire played cards to the deck's discard pile (called at round end for the
   * cards that were in play). `dlc` p.116.
   * @param {Combat} combat
   * @param {object[]} cards
   */
  static async discard(combat, cards) {
    if (!cards?.length) {
      return;
    }
    await dispatchGmOp(ACTION_DECK_OP, { op: "discard", combatId: combat.id, cards });
  }

  /**
   * Flag the deck for a reshuffle at end of the current round (Black Joker trigger).
   * `dlc` p.118.
   * @param {Combat} combat
   */
  static async markReshuffleAtRoundEnd(combat) {
    await dispatchGmOp(ACTION_DECK_OP, { op: "markReshuffle", combatId: combat.id });
  }

  /**
   * Execute the round-end reshuffle if one was flagged. Returns `true` if it ran.
   * `dlc` p.118.
   * @param {Combat} combat
   * @returns {Promise<boolean>}
   */
  static async maybeReshuffleAtRoundEnd(combat) {
    const { reshuffled } = await dispatchGmOp(ACTION_DECK_OP, {
      op: "maybeReshuffle",
      combatId: combat.id,
    });
    return reshuffled;
  }
}
