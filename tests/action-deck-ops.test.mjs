/**
 * Unit tests for applyDeckOp — the pure GM-side applier for the Action Deck
 * wire protocol (module/core/cards/action-deck.mjs). The GM query handler and
 * these tests share the exact same function.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDeckOp,
  buildFullDeck,
  cardLabelRaw,
  shuffleDeck,
} from "../module/core/cards/action-deck.mjs";

const DECK_SIZE = 54;
const rng = () => 0; // deterministic — order is irrelevant to these assertions

/** Fresh initialized fixture state. */
const fullState = () => ({
  drawPile: shuffleDeck(buildFullDeck(), rng),
  discardPile: [],
  reshuffleAtRoundEnd: false,
});

describe("applyDeckOp", () => {
  describe("initialize", () => {
    it("builds a fresh 54-card pile from a null state", () => {
      const { state, result } = applyDeckOp(null, { op: "initialize" }, rng);
      assert.equal(state.drawPile.length, DECK_SIZE);
      assert.equal(state.reshuffleAtRoundEnd, false);
      assert.equal(result.cardsRemaining, DECK_SIZE);
    });

    it("is a no-op on an existing state (same reference back)", () => {
      const existing = fullState();
      const { state } = applyDeckOp(existing, { op: "initialize" }, rng);
      assert.equal(state, existing);
    });
  });

  describe("deal", () => {
    it("deals count cards and shrinks the pile", () => {
      const { state, result } = applyDeckOp(fullState(), { op: "deal", count: 5 }, rng);
      assert.equal(result.dealt.length, 5);
      assert.equal(result.cardsRemaining, DECK_SIZE - 5);
      assert.equal(state.drawPile.length, DECK_SIZE - 5);
    });

    it("recycles the discard pile when the draw pile runs short (dlc p.116)", () => {
      // Arrange — 3 cards left to draw, 17 already played, 5 requested.
      const deck = buildFullDeck();
      const short = {
        drawPile: deck.slice(0, 3),
        discardPile: deck.slice(3, 20),
        reshuffleAtRoundEnd: false,
      };
      // Act
      const { state, result } = applyDeckOp(short, { op: "deal", count: 5 }, rng);
      // Assert — discard folded into draw (3 + 17), then 5 dealt; discard emptied.
      assert.equal(result.dealt.length, 5);
      assert.equal(result.cardsRemaining, 3 + 17 - 5);
      assert.equal(state.discardPile.length, 0);
    });

    it("never manufactures duplicate cards on a short deal (dlc p.116)", () => {
      const deck = buildFullDeck();
      const short = {
        drawPile: deck.slice(0, 2),
        discardPile: deck.slice(2, 12),
        reshuffleAtRoundEnd: false,
      };
      const { state, result } = applyDeckOp(short, { op: "deal", count: 5 }, rng);
      const all = [...result.dealt, ...state.drawPile, ...state.discardPile].map(cardLabelRaw);
      assert.equal(new Set(all).size, all.length); // every card unique — no dupes
    });

    it("deals only what's available when draw and discard are both short", () => {
      // No fresh 54-card deck is ever appended — a short deal simply deals fewer.
      const short = {
        drawPile: buildFullDeck().slice(0, 3),
        discardPile: [],
        reshuffleAtRoundEnd: false,
      };
      const { result } = applyDeckOp(short, { op: "deal", count: 5 }, rng);
      assert.equal(result.dealt.length, 3);
      assert.equal(result.cardsRemaining, 0);
    });

    it("initializes a deck first when the state is null", () => {
      const { result } = applyDeckOp(null, { op: "deal", count: 2 }, rng);
      assert.equal(result.dealt.length, 2);
      assert.equal(result.cardsRemaining, DECK_SIZE - 2);
    });

    it("does not mutate the input state", () => {
      const input = fullState();
      applyDeckOp(input, { op: "deal", count: 5 }, rng);
      assert.equal(input.drawPile.length, DECK_SIZE);
    });

    it("throws on a non-positive or non-integer count", () => {
      assert.throws(() => applyDeckOp(fullState(), { op: "deal", count: 0 }), /positive integer/);
      assert.throws(() => applyDeckOp(fullState(), { op: "deal", count: 1.5 }), /positive integer/);
    });
  });

  describe("discard", () => {
    it("adds cards to the discard pile, leaving the draw pile untouched", () => {
      const deck = buildFullDeck();
      const input = { drawPile: deck.slice(0, 40), discardPile: [], reshuffleAtRoundEnd: false };
      const played = deck.slice(40, 45);
      const { state } = applyDeckOp(input, { op: "discard", cards: played }, rng);
      assert.equal(state.discardPile.length, 5);
      assert.equal(state.drawPile.length, 40);
    });

    it("is a no-op with no cards", () => {
      const input = fullState();
      const { state } = applyDeckOp(input, { op: "discard", cards: [] }, rng);
      assert.equal(state.discardPile.length, 0);
    });
  });

  describe("markReshuffle", () => {
    it("sets the round-end flag and keeps the pile", () => {
      const input = fullState();
      const { state } = applyDeckOp(input, { op: "markReshuffle" }, rng);
      assert.equal(state.reshuffleAtRoundEnd, true);
      assert.deepEqual(state.drawPile, input.drawPile);
    });
  });

  describe("maybeReshuffle", () => {
    it("does nothing when not flagged (same reference back)", () => {
      const input = fullState();
      const { state, result } = applyDeckOp(input, { op: "maybeReshuffle" }, rng);
      assert.equal(state, input);
      assert.equal(result.reshuffled, false);
    });

    it("rebuilds a fresh 54-card pile when flagged", () => {
      const flagged = { drawPile: buildFullDeck().slice(0, 10), reshuffleAtRoundEnd: true };
      const { state, result } = applyDeckOp(flagged, { op: "maybeReshuffle" }, rng);
      assert.equal(result.reshuffled, true);
      assert.equal(state.drawPile.length, DECK_SIZE);
      assert.equal(state.reshuffleAtRoundEnd, false);
    });
  });

  it("throws on an unknown op", () => {
    assert.throws(() => applyDeckOp(fullState(), { op: "peek" }), /Unknown Action Deck op/);
    assert.throws(() => applyDeckOp(fullState(), undefined), /Unknown Action Deck op/);
  });

  it("deal results survive a JSON round trip unchanged (wire contract)", () => {
    const { result } = applyDeckOp(fullState(), { op: "deal", count: 5 }, rng);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  });
});
