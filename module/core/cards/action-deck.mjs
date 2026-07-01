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
 * Deadlands' "highest card acts first" rule. `dlc` p.116-118 (initiative chapter).
 *
 * @see docs/implementation-plan.md §3.2
 * @license MIT
 */

import { DEADLANDS } from "../config.mjs";

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
 * `dlc` p.116: bust → 0; otherwise 1 (base) + 1 per raise, capped at MAX_ACTION_CARDS.
 *
 * @param {{ bust: boolean, raises: number }} rollResult
 * @returns {number}
 */
export function quicknessCardCount({ bust, raises }) {
  if (bust) {
    return 0;
  }
  return Math.min(DEADLANDS.MAX_ACTION_CARDS, 1 + raises);
}

// ── World-state (Foundry-dependent) ─────────────────────────────────────────

const FLAG_SCOPE = "deadlands-classic";
const FLAG_KEY = "deckState";

/**
 * @typedef {{ drawPile: object[], reshuffleAtRoundEnd: boolean }} DeckState
 */

/**
 * Manages the Action Deck as a flag on the active Combat document.
 * Avoids the native Cards API, which has no bridge to Combatant#initiative.
 */
export class ActionDeck {
  // Serializes every read-modify-write per combat on this client, keyed by
  // combat id, so overlapping async calls (e.g. two deal() calls fired close
  // together) can't interleave between their `await` points and clobber each
  // other's draw pile. Does not protect against a genuinely simultaneous
  // write from a *different* client/browser — see the equivalent note on
  // FatePot in module/core/chips/fate-pot.mjs.
  static #queues = new Map();

  static #enqueue(combat, task) {
    const prior = ActionDeck.#queues.get(combat.id) ?? Promise.resolve();
    const result = prior.then(task, task);
    ActionDeck.#queues.set(
      combat.id,
      result.catch(() => {})
    );
    return result;
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
   * @param {() => number} [_rng]
   * @returns {Promise<DeckState>}
   */
  static async initialize(combat, _rng = Math.random) {
    return ActionDeck.#enqueue(combat, () => ActionDeck.#initializeUnsafe(combat, _rng));
  }

  /** @param {Combat} combat @param {() => number} _rng */
  static async #initializeUnsafe(combat, _rng) {
    const existing = this.getState(combat);
    if (existing) {
      return existing;
    }
    const state = {
      drawPile: shuffleDeck(buildFullDeck(), _rng),
      reshuffleAtRoundEnd: false,
    };
    await combat.setFlag(FLAG_SCOPE, FLAG_KEY, state);
    return state;
  }

  /**
   * Draw `count` cards from the pile. Auto-reshuffles a fresh deck if the pile
   * runs empty (normal mid-combat reshuffle, `dlc` p.116).
   * @param {Combat} combat
   * @param {number} count
   * @param {() => number} [_rng]
   * @returns {Promise<object[]>} dealt cards
   */
  static async deal(combat, count, _rng = Math.random) {
    if (count <= 0) {
      return [];
    }
    return ActionDeck.#enqueue(combat, async () => {
      const state = this.getState(combat) ?? (await this.#initializeUnsafe(combat, _rng));
      const drawPile = [...state.drawPile];
      if (drawPile.length < count) {
        drawPile.push(...shuffleDeck(buildFullDeck(), _rng));
      }
      const dealt = drawPile.splice(0, count);
      await combat.setFlag(FLAG_SCOPE, FLAG_KEY, { ...state, drawPile });
      return dealt;
    });
  }

  /**
   * Flag the deck for a reshuffle at end of the current round (Black Joker trigger).
   * `dlc` p.118.
   * @param {Combat} combat
   */
  static async markReshuffleAtRoundEnd(combat) {
    return ActionDeck.#enqueue(combat, async () => {
      const state = this.getState(combat) ?? (await this.#initializeUnsafe(combat, Math.random));
      await combat.setFlag(FLAG_SCOPE, FLAG_KEY, { ...state, reshuffleAtRoundEnd: true });
    });
  }

  /**
   * Execute the round-end reshuffle if one was flagged. Returns `true` if it ran.
   * `dlc` p.118.
   * @param {Combat} combat
   * @param {() => number} [_rng]
   * @returns {Promise<boolean>}
   */
  static async maybeReshuffleAtRoundEnd(combat, _rng = Math.random) {
    return ActionDeck.#enqueue(combat, async () => {
      const state = this.getState(combat);
      if (!state?.reshuffleAtRoundEnd) {
        return false;
      }
      await combat.setFlag(FLAG_SCOPE, FLAG_KEY, {
        drawPile: shuffleDeck(buildFullDeck(), _rng),
        reshuffleAtRoundEnd: false,
      });
      return true;
    });
  }
}
