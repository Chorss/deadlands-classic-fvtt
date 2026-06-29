/**
 * Unit tests for the poker-hand-evaluator.
 * All 11 Deadlands hand types tested, plus wildcard (joker) cases. hnh p.34, dlc p.160.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateHand,
  meetsMinHand,
  POKER_HAND_RANKS,
} from "../module/core/dice/poker-hand-evaluator.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function card(rank, suit) {
  return { rank, suit, joker: null };
}

function joker(type = "black") {
  return { rank: null, suit: null, joker: type };
}

// ── Hand rank enumeration ────────────────────────────────────────────────────

describe("POKER_HAND_RANKS", () => {
  it("has 11 entries ordered from lowest to highest", () => {
    assert.equal(POKER_HAND_RANKS.length, 11);
    assert.equal(POKER_HAND_RANKS[0], "ace");
    assert.equal(POKER_HAND_RANKS[10], "royalFlush");
  });
});

// ── No qualifying hand ───────────────────────────────────────────────────────

describe("evaluateHand — none", () => {
  it("returns handRank −1 for five unrelated non-ace cards", () => {
    const _cards = [
      card("3", "spades"),
      card("5", "hearts"),
      card("7", "diamonds"),
      card("9", "clubs"),
      card("J", "spades"),
    ];
    // J pair would be Jacks — replace J with a non-high
    const cards2 = [
      card("3", "spades"),
      card("5", "hearts"),
      card("7", "diamonds"),
      card("9", "clubs"),
      card("10", "spades"),
    ];
    const result = evaluateHand(cards2);
    // 10 is not a high card but also no pair/ace
    assert.equal(result.handRank, -1);
    assert.equal(result.handKey, "none");
  });
});

// ── Ace ───────────────────────────────────────────────────────────────────────

describe("evaluateHand — ace", () => {
  it("detects a single Ace with other non-pairing cards", () => {
    const cards = [
      card("A", "spades"),
      card("3", "hearts"),
      card("5", "diamonds"),
      card("7", "clubs"),
      card("9", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 0);
    assert.equal(result.handKey, "ace");
  });
});

// ── Pair ─────────────────────────────────────────────────────────────────────

describe("evaluateHand — pair", () => {
  it("detects a pair of 3s", () => {
    const cards = [
      card("3", "spades"),
      card("3", "hearts"),
      card("5", "diamonds"),
      card("7", "clubs"),
      card("9", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 1);
    assert.equal(result.handKey, "pair");
  });
});

// ── Jacks or Better ──────────────────────────────────────────────────────────

describe("evaluateHand — jacks", () => {
  it("detects a pair of Queens", () => {
    const cards = [
      card("Q", "spades"),
      card("Q", "hearts"),
      card("3", "diamonds"),
      card("5", "clubs"),
      card("7", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 2);
    assert.equal(result.handKey, "jacks");
  });

  it("pair of 2s is only Pair, not Jacks", () => {
    const cards = [
      card("2", "spades"),
      card("2", "hearts"),
      card("4", "diamonds"),
      card("6", "clubs"),
      card("8", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handKey, "pair");
  });
});

// ── Two Pair ─────────────────────────────────────────────────────────────────

describe("evaluateHand — twoPair", () => {
  it("detects two pairs", () => {
    const cards = [
      card("4", "spades"),
      card("4", "hearts"),
      card("K", "diamonds"),
      card("K", "clubs"),
      card("7", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 3);
    assert.equal(result.handKey, "twoPair");
  });
});

// ── Three of a Kind ──────────────────────────────────────────────────────────

describe("evaluateHand — threeOfAKind", () => {
  it("detects three 9s", () => {
    const cards = [
      card("9", "spades"),
      card("9", "hearts"),
      card("9", "diamonds"),
      card("4", "clubs"),
      card("6", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 4);
    assert.equal(result.handKey, "threeOfAKind");
  });
});

// ── Straight ─────────────────────────────────────────────────────────────────

describe("evaluateHand — straight", () => {
  it("detects 5-6-7-8-9 straight", () => {
    const cards = [
      card("5", "spades"),
      card("6", "hearts"),
      card("7", "diamonds"),
      card("8", "clubs"),
      card("9", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 5);
    assert.equal(result.handKey, "straight");
  });

  it("detects A-2-3-4-5 wheel (low ace)", () => {
    const cards = [
      card("A", "spades"),
      card("2", "hearts"),
      card("3", "diamonds"),
      card("4", "clubs"),
      card("5", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 5);
    assert.equal(result.handKey, "straight");
  });
});

// ── Flush ────────────────────────────────────────────────────────────────────

describe("evaluateHand — flush", () => {
  it("detects five spades (non-straight)", () => {
    const cards = [
      card("2", "spades"),
      card("4", "spades"),
      card("6", "spades"),
      card("8", "spades"),
      card("K", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 6);
    assert.equal(result.handKey, "flush");
  });
});

// ── Full House ───────────────────────────────────────────────────────────────

describe("evaluateHand — fullHouse", () => {
  it("detects three Ks and two 5s", () => {
    const cards = [
      card("K", "spades"),
      card("K", "hearts"),
      card("K", "diamonds"),
      card("5", "clubs"),
      card("5", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 7);
    assert.equal(result.handKey, "fullHouse");
  });
});

// ── Four of a Kind ───────────────────────────────────────────────────────────

describe("evaluateHand — fourOfAKind", () => {
  it("detects four Aces", () => {
    const cards = [
      card("A", "spades"),
      card("A", "hearts"),
      card("A", "diamonds"),
      card("A", "clubs"),
      card("5", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 8);
    assert.equal(result.handKey, "fourOfAKind");
  });
});

// ── Straight Flush ───────────────────────────────────────────────────────────

describe("evaluateHand — straightFlush", () => {
  it("detects 5-9 all hearts", () => {
    const cards = [
      card("5", "hearts"),
      card("6", "hearts"),
      card("7", "hearts"),
      card("8", "hearts"),
      card("9", "hearts"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 9);
    assert.equal(result.handKey, "straightFlush");
  });
});

// ── Royal Flush ──────────────────────────────────────────────────────────────

describe("evaluateHand — royalFlush", () => {
  it("detects 10-J-Q-K-A all spades", () => {
    const cards = [
      card("10", "spades"),
      card("J", "spades"),
      card("Q", "spades"),
      card("K", "spades"),
      card("A", "spades"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handRank, 10);
    assert.equal(result.handKey, "royalFlush");
  });
});

// ── Joker (wild card) cases ───────────────────────────────────────────────────

describe("evaluateHand — joker wild cards", () => {
  it("one joker + four 7s = four of a kind", () => {
    const cards = [
      joker(),
      card("7", "spades"),
      card("7", "hearts"),
      card("7", "diamonds"),
      card("7", "clubs"),
    ];
    // Four 7s = four of a kind, but we also have a joker → could make five of a kind — cap at four
    const result = evaluateHand(cards);
    // 4 regular 7s = four of a kind already; with joker it's still fourOfAKind (capped at 4)
    assert.ok(result.handRank >= 8);
  });

  it("two jokers + A-K-Q complete a royal flush", () => {
    const cards = [
      joker("red"),
      joker("black"),
      card("A", "diamonds"),
      card("K", "diamonds"),
      card("Q", "diamonds"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.handKey, "royalFlush");
  });

  it("one joker upgrades a pair to three of a kind", () => {
    const cards = [
      joker("red"),
      card("8", "spades"),
      card("8", "hearts"),
      card("3", "diamonds"),
      card("5", "clubs"),
    ];
    const result = evaluateHand(cards);
    assert.ok(result.handRank >= 4); // at least three of a kind
  });

  it("one joker with high card A meets Ace requirement", () => {
    const cards = [
      joker("black"),
      card("3", "spades"),
      card("5", "hearts"),
      card("7", "diamonds"),
      card("9", "clubs"),
    ];
    const result = evaluateHand(cards);
    assert.ok(result.handRank >= 0); // Ace (or better)
  });

  it("jokerType is 'black' when a black joker is present", () => {
    const cards = [
      joker("black"),
      card("3", "spades"),
      card("5", "hearts"),
      card("7", "diamonds"),
      card("9", "clubs"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.jokerType, "black");
  });

  it("jokerType is 'red' when only a red joker is present", () => {
    const cards = [
      joker("red"),
      card("3", "spades"),
      card("5", "hearts"),
      card("7", "diamonds"),
      card("9", "clubs"),
    ];
    const result = evaluateHand(cards);
    assert.equal(result.jokerType, "red");
  });
});

// ── meetsMinHand ──────────────────────────────────────────────────────────────

describe("meetsMinHand", () => {
  it("full house meets 'pair' minimum", () => {
    const result = { handRank: 7, handKey: "fullHouse" };
    assert.equal(meetsMinHand(result, "pair"), true);
  });

  it("pair does NOT meet 'jacks' minimum", () => {
    const result = { handRank: 1, handKey: "pair" };
    assert.equal(meetsMinHand(result, "jacks"), false);
  });

  it("jacks meets 'jacks' minimum exactly", () => {
    const result = { handRank: 2, handKey: "jacks" };
    assert.equal(meetsMinHand(result, "jacks"), true);
  });

  it("none does not meet 'ace' minimum", () => {
    const result = { handRank: -1, handKey: "none" };
    assert.equal(meetsMinHand(result, "ace"), false);
  });

  it("returns false for unknown hand key", () => {
    const result = { handRank: 5, handKey: "straight" };
    assert.equal(meetsMinHand(result, "invalidKey"), false);
  });
});
