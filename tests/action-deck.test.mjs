/**
 * Unit tests for the pure helpers in action-deck.mjs.
 * No Foundry globals are touched — all tested functions are dependency-free.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Stub the DEADLANDS config that action-deck.mjs imports from config.mjs.
// We replicate only the fields used by the pure helpers.
import {
  buildFullDeck,
  cardLabelRaw,
  cardValue,
  compareCards,
  quicknessCardCount,
  shuffleDeck,
} from "../module/core/cards/action-deck.mjs";

// ── cardValue ────────────────────────────────────────────────────────────────

describe("cardValue", () => {
  it("Red Joker = 999 (highest)", () => {
    assert.equal(cardValue({ rank: null, suit: null, joker: "red" }), 999);
  });

  it("Black Joker = 998", () => {
    assert.equal(cardValue({ rank: null, suit: null, joker: "black" }), 998);
  });

  it("Ace of Spades = 144 (rank 14 × 10 + suit 4)", () => {
    assert.equal(cardValue({ rank: "A", suit: "spades", joker: null }), 144);
  });

  it("Ace of Hearts = 143", () => {
    assert.equal(cardValue({ rank: "A", suit: "hearts", joker: null }), 143);
  });

  it("Ace of Diamonds = 142", () => {
    assert.equal(cardValue({ rank: "A", suit: "diamonds", joker: null }), 142);
  });

  it("Ace of Clubs = 141", () => {
    assert.equal(cardValue({ rank: "A", suit: "clubs", joker: null }), 141);
  });

  it("King of Spades = 134", () => {
    assert.equal(cardValue({ rank: "K", suit: "spades", joker: null }), 134);
  });

  it("2 of Clubs = 21 (lowest regular card)", () => {
    assert.equal(cardValue({ rank: "2", suit: "clubs", joker: null }), 21);
  });

  it("2 of Spades = 24", () => {
    assert.equal(cardValue({ rank: "2", suit: "spades", joker: null }), 24);
  });
});

// ── compareCards ─────────────────────────────────────────────────────────────

describe("compareCards (descending order)", () => {
  it("Red Joker beats Black Joker", () => {
    const rj = { rank: null, suit: null, joker: "red" };
    const bj = { rank: null, suit: null, joker: "black" };
    assert.ok(compareCards(rj, bj) < 0, "Red Joker should sort before Black Joker");
  });

  it("Black Joker beats Ace of Spades", () => {
    const bj = { rank: null, suit: null, joker: "black" };
    const as = { rank: "A", suit: "spades", joker: null };
    assert.ok(compareCards(bj, as) < 0);
  });

  it("Ace of Spades beats Ace of Hearts (suit tiebreaker, dlc p.117)", () => {
    const as = { rank: "A", suit: "spades", joker: null };
    const ah = { rank: "A", suit: "hearts", joker: null };
    assert.ok(compareCards(as, ah) < 0);
  });

  it("Ace of Hearts beats Ace of Diamonds", () => {
    const ah = { rank: "A", suit: "hearts", joker: null };
    const ad = { rank: "A", suit: "diamonds", joker: null };
    assert.ok(compareCards(ah, ad) < 0);
  });

  it("Ace of Diamonds beats Ace of Clubs", () => {
    const ad = { rank: "A", suit: "diamonds", joker: null };
    const ac = { rank: "A", suit: "clubs", joker: null };
    assert.ok(compareCards(ad, ac) < 0);
  });

  it("King beats Queen same suit", () => {
    const k = { rank: "K", suit: "spades", joker: null };
    const q = { rank: "Q", suit: "spades", joker: null };
    assert.ok(compareCards(k, q) < 0);
  });

  it("3 of Spades beats 2 of Spades", () => {
    const three = { rank: "3", suit: "spades", joker: null };
    const two = { rank: "2", suit: "spades", joker: null };
    assert.ok(compareCards(three, two) < 0);
  });

  it("2 of Spades beats 2 of Hearts (suit tiebreaker)", () => {
    const twos = { rank: "2", suit: "spades", joker: null };
    const twoh = { rank: "2", suit: "hearts", joker: null };
    assert.ok(compareCards(twos, twoh) < 0);
  });

  it("sort puts full hand in correct descending order", () => {
    const hand = [
      { rank: "2", suit: "clubs", joker: null },
      { rank: "A", suit: "hearts", joker: null },
      { rank: null, suit: null, joker: "red" },
      { rank: "K", suit: "spades", joker: null },
    ];
    const sorted = [...hand].sort(compareCards);
    assert.equal(sorted[0].joker, "red");
    assert.equal(sorted[1].rank, "A");
    assert.equal(sorted[2].rank, "K");
    assert.equal(sorted[3].rank, "2");
  });
});

// ── cardLabelRaw ─────────────────────────────────────────────────────────────

describe("cardLabelRaw", () => {
  it("regular card", () => {
    assert.equal(cardLabelRaw({ rank: "A", suit: "spades", joker: null }), "A of Spades");
  });

  it("Red Joker", () => {
    assert.equal(cardLabelRaw({ rank: null, suit: null, joker: "red" }), "Red Joker");
  });

  it("Black Joker", () => {
    assert.equal(cardLabelRaw({ rank: null, suit: null, joker: "black" }), "Black Joker");
  });

  it("numeric rank", () => {
    assert.equal(cardLabelRaw({ rank: "10", suit: "hearts", joker: null }), "10 of Hearts");
  });
});

// ── buildFullDeck ────────────────────────────────────────────────────────────

describe("buildFullDeck", () => {
  it("returns exactly 54 cards", () => {
    assert.equal(buildFullDeck().length, 54);
  });

  it("contains exactly 2 jokers", () => {
    const jokers = buildFullDeck().filter((c) => c.joker);
    assert.equal(jokers.length, 2);
    assert.ok(jokers.some((c) => c.joker === "red"));
    assert.ok(jokers.some((c) => c.joker === "black"));
  });

  it("contains 52 non-joker cards", () => {
    const regular = buildFullDeck().filter((c) => !c.joker);
    assert.equal(regular.length, 52);
  });

  it("all 4 suits present with 13 cards each", () => {
    const regular = buildFullDeck().filter((c) => !c.joker);
    for (const suit of ["spades", "hearts", "diamonds", "clubs"]) {
      const count = regular.filter((c) => c.suit === suit).length;
      assert.equal(count, 13, `Expected 13 ${suit}, got ${count}`);
    }
  });

  it("all 13 ranks present in each suit", () => {
    const regular = buildFullDeck().filter((c) => !c.joker);
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    for (const suit of ["spades", "hearts", "diamonds", "clubs"]) {
      const suitCards = regular.filter((c) => c.suit === suit).map((c) => c.rank);
      for (const rank of ranks) {
        assert.ok(suitCards.includes(rank), `Missing ${rank} of ${suit}`);
      }
    }
  });

  it("no duplicate cards", () => {
    const deck = buildFullDeck();
    const labels = deck.map((c) => cardLabelRaw(c));
    const unique = new Set(labels);
    assert.equal(unique.size, 54);
  });
});

// ── shuffleDeck ──────────────────────────────────────────────────────────────

describe("shuffleDeck", () => {
  it("returns same 54 cards in different order (seeded RNG)", () => {
    // Deterministic RNG — a simple counter
    let i = 0;
    const rng = () => [0.1, 0.5, 0.9, 0.3, 0.7][i++ % 5];
    const deck = buildFullDeck();
    const shuffled = shuffleDeck(deck, rng);
    assert.equal(shuffled.length, 54);
    // Same multiset of card labels
    const before = deck.map(cardLabelRaw).sort();
    const after = shuffled.map(cardLabelRaw).sort();
    assert.deepEqual(before, after);
  });

  it("does not mutate the original array", () => {
    const deck = buildFullDeck();
    const first = deck[0];
    shuffleDeck(deck);
    assert.equal(deck[0], first);
  });
});

// ── quicknessCardCount ───────────────────────────────────────────────────────

describe("quicknessCardCount (dlc p.116)", () => {
  it("bust → 0 cards", () => {
    assert.equal(quicknessCardCount({ bust: true, raises: 0 }), 0);
  });

  it("no raises → 1 card (base)", () => {
    assert.equal(quicknessCardCount({ bust: false, raises: 0 }), 1);
  });

  it("1 raise → 2 cards", () => {
    assert.equal(quicknessCardCount({ bust: false, raises: 1 }), 2);
  });

  it("4 raises → 5 cards (max)", () => {
    assert.equal(quicknessCardCount({ bust: false, raises: 4 }), 5);
  });

  it("5+ raises → capped at 5", () => {
    assert.equal(quicknessCardCount({ bust: false, raises: 10 }), 5);
  });
});
