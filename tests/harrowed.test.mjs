/**
 * Unit tests for Harrowed overlay — pure logic only.
 * No Foundry runtime needed. Covers resolveDominionRoll.
 *
 * Rules source: bod p.80-82 (Dominion Roll, Marshal section).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  manitouSpiritFromCard,
  resolveDominionRoll,
} from "../module/archetypes/_overlays/harrowed/mechanics.mjs";

describe("resolveDominionRoll", () => {
  // ── No-change cases ──────────────────────────────────────────────────────

  it("returns no change when neither side reaches TN 5", () => {
    // Arrange
    const params = { pcRoll: 2, pcDominion: 1, npcRoll: 1, npcDominion: 2 };
    // pcTotal=3, npcTotal=3 — both below TN
    // Act
    const result = resolveDominionRoll(params);
    // Assert — bod p.80: "no change in Dominion"
    assert.equal(result.winner, "none");
    assert.equal(result.pointsGained, 0);
    assert.equal(result.pcTotal, 3);
    assert.equal(result.npcTotal, 3);
  });

  it("returns no change when both totals are exactly 4", () => {
    const result = resolveDominionRoll({ pcRoll: 4, pcDominion: 0, npcRoll: 4, npcDominion: 0 });
    assert.equal(result.winner, "none");
    assert.equal(result.pointsGained, 0);
  });

  // ── PC wins ──────────────────────────────────────────────────────────────

  it("PC wins with 1 point (no raises) when only PC reaches TN", () => {
    // Arrange — pcTotal=6, npcTotal=3
    const result = resolveDominionRoll({ pcRoll: 5, pcDominion: 1, npcRoll: 1, npcDominion: 2 });
    // Act + Assert
    assert.equal(result.winner, "pc");
    assert.equal(result.pcTotal, 6);
    assert.equal(result.npcTotal, 3);
    // margin = 6 - 3 = 3 → floor(3/5) = 0 raises → 1 point. dlc p.30.
    assert.equal(result.pointsGained, 1);
  });

  it("PC wins with raises when margin exceeds 5", () => {
    // Arrange — pcTotal=15, npcTotal=4
    const result = resolveDominionRoll({ pcRoll: 12, pcDominion: 3, npcRoll: 2, npcDominion: 2 });
    // margin = 15 - 4 = 11 → floor(11/5) = 2 raises → 3 points
    assert.equal(result.winner, "pc");
    assert.equal(result.pointsGained, 3);
  });

  it("PC wins with 2 raises when margin is exactly 10", () => {
    // pcTotal=14, npcTotal=4 → margin=14-4=10 → 2 raises → 3 pts
    const result = resolveDominionRoll({ pcRoll: 10, pcDominion: 4, npcRoll: 2, npcDominion: 2 });
    assert.equal(result.winner, "pc");
    assert.equal(result.pointsGained, 3);
  });

  it("a tie is no change, not a PC win", () => {
    // dlc p.29: "the character who beats the TN and his opponent wins" — a
    // tie beats neither. bod doesn't override this for Dominion.
    const result = resolveDominionRoll({ pcRoll: 3, pcDominion: 3, npcRoll: 4, npcDominion: 2 });
    // pcTotal=6, npcTotal=6
    assert.equal(result.winner, "none");
    assert.equal(result.pointsGained, 0);
  });

  // ── Manitou wins ─────────────────────────────────────────────────────────

  it("Manitou wins with 1 raise when margin is exactly 5", () => {
    // npcTotal=7, pcTotal=2 → margin=5 → 1 raise → 2 points. dlc p.30
    // (raises are counted from the opponent's total, no TN floor).
    const result = resolveDominionRoll({ pcRoll: 1, pcDominion: 1, npcRoll: 5, npcDominion: 2 });
    assert.equal(result.winner, "manitou");
    assert.equal(result.pointsGained, 2);
  });

  it("Manitou wins with raises when margin is large", () => {
    // npcTotal=18, pcTotal=3
    const result = resolveDominionRoll({ pcRoll: 1, pcDominion: 2, npcRoll: 14, npcDominion: 4 });
    // margin = 18 - 3 = 15 → floor(15/5)=3 raises → 4 pts
    assert.equal(result.winner, "manitou");
    assert.equal(result.pointsGained, 4);
  });

  it("Manitou wins with 1 raise when margin is 6 (still below 2 raises)", () => {
    // npcTotal=13, pcTotal=7 → margin=13-7=6 → floor(6/5)=1 raise → 2 pts
    const result = resolveDominionRoll({ pcRoll: 5, pcDominion: 2, npcRoll: 9, npcDominion: 4 });
    assert.equal(result.winner, "manitou");
    assert.equal(result.pointsGained, 2);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  it("works when PC has full Dominion (npcDominion=0)", () => {
    // Total Dominion case: PC holds all points; Manitou still rolls Spirit
    const result = resolveDominionRoll({ pcRoll: 4, pcDominion: 4, npcRoll: 6, npcDominion: 0 });
    // pcTotal=8, npcTotal=6 → PC wins
    assert.equal(result.winner, "pc");
  });

  it("works when Manitou has full Dominion (pcDominion=0)", () => {
    // Manitou holds all points
    const result = resolveDominionRoll({ pcRoll: 6, pcDominion: 0, npcRoll: 3, npcDominion: 4 });
    // pcTotal=6, npcTotal=7 → Manitou wins
    assert.equal(result.winner, "manitou");
  });

  it("returns correct pcTotal and npcTotal for downstream use", () => {
    const result = resolveDominionRoll({ pcRoll: 7, pcDominion: 2, npcRoll: 3, npcDominion: 1 });
    assert.equal(result.pcTotal, 9);
    assert.equal(result.npcTotal, 4);
  });
});

// ── manitouSpiritFromCard (bod p.87, dlc p.194) ────────────────────────────────

describe("manitouSpiritFromCard", () => {
  const pcSpirit = { dieCount: 2, dieType: "d8" };

  it("card 2 → Legion", () => {
    const result = manitouSpiritFromCard({ rank: "2", joker: null }, pcSpirit);
    assert.equal(result.kind, "legion");
  });

  it("cards 3-8 → same Spirit as the hero's", () => {
    const result = manitouSpiritFromCard({ rank: "6", joker: null }, pcSpirit);
    assert.equal(result.kind, "normal");
    assert.equal(result.dieCount, 2);
    assert.equal(result.dieType, "d8");
  });

  it("cards 9-Jack → same die type, +1 die", () => {
    const result = manitouSpiritFromCard({ rank: "J", joker: null }, pcSpirit);
    assert.equal(result.kind, "normal");
    assert.equal(result.dieCount, 3);
    assert.equal(result.dieType, "d8");
  });

  it("cards Queen-Ace → die type +1 step, +2 dice", () => {
    const result = manitouSpiritFromCard({ rank: "A", joker: null }, pcSpirit);
    assert.equal(result.kind, "normal");
    assert.equal(result.dieCount, 4);
    assert.equal(result.dieType, "d10");
  });

  it("die type step-up clamps at d12 (doesn't run off the ladder)", () => {
    const result = manitouSpiritFromCard(
      { rank: "K", joker: null },
      { dieCount: 1, dieType: "d12" }
    );
    assert.equal(result.dieType, "d12");
  });

  it("Joker → Greater Manitou", () => {
    const result = manitouSpiritFromCard({ rank: null, joker: "red" }, pcSpirit);
    assert.equal(result.kind, "greater");
  });
});
