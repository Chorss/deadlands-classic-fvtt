/**
 * Poker hand evaluator for Deadlands Classic hexslingin'.
 *
 * Implements the Deadlands hand hierarchy (hnh p.34, dlc p.160), which differs
 * from standard poker by splitting "Pair" into two tiers: "Pair" (any pair) and
 * "Jacks or Better" (pair of Jacks, Queens, Kings, or Aces). Jokers are wild.
 *
 * The evaluator finds the BEST 5-card sub-hand from an arbitrary number of drawn
 * cards (5 base + 1 per raise on the hexslingin' roll, capped at 10 in practice).
 *
 * @license MIT
 */

/**
 * Deadlands hand hierarchy from lowest (0) to highest (10). `hnh` p.34 / `dlc` p.160.
 * @type {readonly string[]}
 */
export const POKER_HAND_RANKS = [
  "ace", // 0 — at least one Ace in hand
  "pair", // 1 — any pair
  "jacks", // 2 — pair of Jacks or better (J/Q/K/A)
  "twoPair", // 3 — two pairs
  "threeOfAKind", // 4 — three of a kind
  "straight", // 5 — five consecutive ranks (any suits)
  "flush", // 6 — five of the same suit
  "fullHouse", // 7 — three of a kind + pair
  "fourOfAKind", // 8 — four of a kind
  "straightFlush", // 9 — five consecutive same-suit
  "royalFlush", // 10 — 10/J/Q/K/A same suit
];

// Card rank order A = highest (index 12). Low-ace handled separately.
const RANK_ORDER = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_IDX = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i]));
const HIGH_RANKS = new Set(["J", "Q", "K", "A"]); // Jacks or Better threshold
const ROYAL_RANKS = new Set(["10", "J", "Q", "K", "A"]);

/**
 * @typedef {{ rank: string|null, suit: string|null, joker: string|null }} Card
 * @typedef {{ handRank: number, handKey: string, hasJoker: boolean, jokerType: string|null }} HandResult
 */

/**
 * Evaluate the best Deadlands poker hand from a set of drawn cards.
 * Jokers are wild (they can substitute for any card).
 *
 * @param {Card[]} cards — drawn cards (5–10 in practice)
 * @returns {HandResult}
 */
export function evaluateHand(cards) {
  const jokers = cards.filter((c) => c.joker);
  const regular = cards.filter((c) => !c.joker);
  const jokerCount = jokers.length;
  const hasJoker = jokerCount > 0;
  const jokerType = jokers.some((j) => j.joker === "black")
    ? "black"
    : hasJoker
      ? "red"
      : null;

  // Group regular cards by rank and suit.
  const byRank = new Map();
  const bySuit = new Map();
  for (const c of regular) {
    if (c.rank) byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1);
    if (c.suit) bySuit.set(c.suit, (bySuit.get(c.suit) ?? 0) + 1);
  }

  const maxRankCount = byRank.size > 0 ? Math.max(...byRank.values()) : 0;
  const maxSuitCount = bySuit.size > 0 ? Math.max(...bySuit.values()) : 0;
  const hasAce = byRank.has("A");

  // Check each hand type from best to worst — return immediately on the first match.

  // Royal Flush: 10,J,Q,K,A of one suit + wild cards to fill gaps.
  for (const [suit] of bySuit) {
    const royalInSuit = regular.filter((c) => c.suit === suit && ROYAL_RANKS.has(c.rank)).length;
    if (royalInSuit + jokerCount >= 5) return hand(10, "royalFlush", hasJoker, jokerType);
  }
  if (jokerCount >= 5) return hand(10, "royalFlush", hasJoker, jokerType);

  // Straight Flush
  if (_checkStraightFlush(regular, jokerCount)) return hand(9, "straightFlush", hasJoker, jokerType);

  // Four of a Kind: best rank count + wilds ≥ 4.
  if (maxRankCount + jokerCount >= 4) return hand(8, "fourOfAKind", hasJoker, jokerType);

  // Full House
  if (_checkFullHouse(regular, jokerCount)) return hand(7, "fullHouse", hasJoker, jokerType);

  // Flush: best suit count + wilds ≥ 5.
  if (maxSuitCount + jokerCount >= 5) return hand(6, "flush", hasJoker, jokerType);

  // Straight
  if (_checkStraight(regular, jokerCount)) return hand(5, "straight", hasJoker, jokerType);

  // Three of a Kind
  if (maxRankCount + jokerCount >= 3) return hand(4, "threeOfAKind", hasJoker, jokerType);

  // Two Pair
  if (_checkTwoPair(regular, jokerCount)) return hand(3, "twoPair", hasJoker, jokerType);

  // Jacks or Better
  if (_checkJacksOrBetter(regular, jokerCount)) return hand(2, "jacks", hasJoker, jokerType);

  // Any Pair
  if (maxRankCount + jokerCount >= 2) return hand(1, "pair", hasJoker, jokerType);

  // Ace (or wild card treated as Ace)
  if (hasAce || jokerCount >= 1) return hand(0, "ace", hasJoker, jokerType);

  return hand(-1, "none", hasJoker, jokerType);
}

/**
 * Returns true if the evaluated hand meets or beats the required minimum hand.
 * @param {HandResult} evaluated
 * @param {string} minHandKey — one of the POKER_HAND_RANKS keys
 * @returns {boolean}
 */
export function meetsMinHand(evaluated, minHandKey) {
  const minRank = POKER_HAND_RANKS.indexOf(minHandKey);
  return minRank >= 0 && evaluated.handRank >= minRank;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function hand(handRank, handKey, hasJoker, jokerType) {
  return { handRank, handKey, hasJoker, jokerType };
}

function _checkStraightFlush(regular, jokerCount) {
  const suits = [...new Set(regular.map((c) => c.suit).filter(Boolean))];
  for (const suit of suits) {
    const suitIdxSet = new Set(
      regular.filter((c) => c.suit === suit && c.rank).map((c) => RANK_IDX[c.rank]),
    );
    if (suitIdxSet.has(12)) suitIdxSet.add(-1); // Ace can be low
    if (_windowCheck(suitIdxSet, jokerCount)) return true;
  }
  return false;
}

function _checkStraight(regular, jokerCount) {
  const idxSet = new Set(regular.filter((c) => c.rank).map((c) => RANK_IDX[c.rank]));
  if (idxSet.has(12)) idxSet.add(-1); // Ace can be low
  return _windowCheck(idxSet, jokerCount);
}

/** Sliding-window check: can any 5-consecutive-rank window be filled with present ranks + wilds? */
function _windowCheck(rankIdxSet, jokerCount) {
  for (let lo = -1; lo <= 8; lo++) {
    let covered = 0;
    for (let r = lo; r <= lo + 4; r++) {
      if (rankIdxSet.has(r)) covered++;
    }
    if (covered + jokerCount >= 5) return true;
  }
  return false;
}

function _checkFullHouse(regular, jokerCount) {
  const rankNums = {};
  for (const c of regular) {
    if (c.rank) rankNums[c.rank] = (rankNums[c.rank] ?? 0) + 1;
  }
  const ranks = Object.keys(rankNums);
  if (ranks.length === 0) return false;

  for (const tripsRank of ranks) {
    const jAfterTrips = jokerCount - Math.max(0, 3 - rankNums[tripsRank]);
    if (jAfterTrips < 0) continue;
    for (const pairRank of ranks) {
      if (pairRank === tripsRank) continue;
      if (jAfterTrips >= Math.max(0, 2 - rankNums[pairRank])) return true;
    }
    if (ranks.length === 1 && jAfterTrips >= 2) return true;
  }
  return false;
}

function _checkTwoPair(regular, jokerCount) {
  const rankNums = {};
  for (const c of regular) {
    if (c.rank) rankNums[c.rank] = (rankNums[c.rank] ?? 0) + 1;
  }
  const values = Object.values(rankNums);
  const pairs = values.filter((n) => n >= 2).length;
  if (pairs >= 2) return true;
  if (pairs >= 1 && jokerCount >= 1) return true;
  const singles = values.filter((n) => n === 1).length;
  if (pairs === 0 && jokerCount >= 2 && singles >= 2) return true;
  return false;
}

function _checkJacksOrBetter(regular, jokerCount) {
  const rankNums = {};
  for (const c of regular) {
    if (c.rank) rankNums[c.rank] = (rankNums[c.rank] ?? 0) + 1;
  }
  for (const r of HIGH_RANKS) {
    if ((rankNums[r] ?? 0) >= 2) return true;
  }
  if (jokerCount >= 1) {
    for (const r of HIGH_RANKS) {
      if ((rankNums[r] ?? 0) >= 1) return true;
    }
    if (jokerCount >= 2) return true; // 2 wilds → any Jacks pair
  }
  return false;
}
