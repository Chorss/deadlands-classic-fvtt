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
  const jokerType = jokers.some((j) => j.joker === "black") ? "black" : hasJoker ? "red" : null;

  const { bySuit, maxRankCount, maxSuitCount, hasAce } = _buildCardMaps(regular);
  const mk = (rank, key) => hand(rank, key, hasJoker, jokerType);

  if (_checkRoyalFlush(bySuit, regular, jokerCount)) {
    return mk(10, "royalFlush");
  }
  if (_checkStraightFlush(regular, jokerCount)) {
    return mk(9, "straightFlush");
  }
  if (maxRankCount + jokerCount >= 4) {
    return mk(8, "fourOfAKind");
  }
  if (_checkFullHouse(regular, jokerCount)) {
    return mk(7, "fullHouse");
  }
  if (maxSuitCount + jokerCount >= 5) {
    return mk(6, "flush");
  }
  if (_checkStraight(regular, jokerCount)) {
    return mk(5, "straight");
  }
  if (maxRankCount + jokerCount >= 3) {
    return mk(4, "threeOfAKind");
  }
  if (_checkTwoPair(regular, jokerCount)) {
    return mk(3, "twoPair");
  }
  if (_checkJacksOrBetter(regular, jokerCount)) {
    return mk(2, "jacks");
  }
  if (maxRankCount + jokerCount >= 2) {
    return mk(1, "pair");
  }
  if (hasAce || jokerCount >= 1) {
    return mk(0, "ace");
  }
  return mk(-1, "none");
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

/** Build rank/suit frequency maps and derived counts from non-joker cards. */
function _buildCardMaps(regular) {
  const byRank = new Map();
  const bySuit = new Map();
  for (const c of regular) {
    if (c.rank) {
      byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1);
    }
    if (c.suit) {
      bySuit.set(c.suit, (bySuit.get(c.suit) ?? 0) + 1);
    }
  }
  return {
    byRank,
    bySuit,
    maxRankCount: byRank.size > 0 ? Math.max(...byRank.values()) : 0,
    maxSuitCount: bySuit.size > 0 ? Math.max(...bySuit.values()) : 0,
    hasAce: byRank.has("A"),
  };
}

/** Royal Flush: 10/J/Q/K/A of one suit, gaps filled by wilds. */
function _checkRoyalFlush(bySuit, regular, jokerCount) {
  if (jokerCount >= 5) {
    return true;
  }
  for (const [suit] of bySuit) {
    const royalInSuit = regular.filter((c) => c.suit === suit && ROYAL_RANKS.has(c.rank)).length;
    if (royalInSuit + jokerCount >= 5) {
      return true;
    }
  }
  return false;
}

/** Count occurrences of each rank among non-joker cards. */
function _countByRank(regular) {
  const counts = {};
  for (const c of regular) {
    if (c.rank) {
      counts[c.rank] = (counts[c.rank] ?? 0) + 1;
    }
  }
  return counts;
}

function _checkStraightFlush(regular, jokerCount) {
  const suits = [...new Set(regular.map((c) => c.suit).filter(Boolean))];
  for (const suit of suits) {
    const suitIdxSet = new Set(
      regular.filter((c) => c.suit === suit && c.rank).map((c) => RANK_IDX[c.rank])
    );
    if (suitIdxSet.has(12)) {
      suitIdxSet.add(-1); // Ace can be low
    }
    if (_windowCheck(suitIdxSet, jokerCount)) {
      return true;
    }
  }
  return false;
}

function _checkStraight(regular, jokerCount) {
  const idxSet = new Set(regular.filter((c) => c.rank).map((c) => RANK_IDX[c.rank]));
  if (idxSet.has(12)) {
    idxSet.add(-1); // Ace can be low
  }
  return _windowCheck(idxSet, jokerCount);
}

/** Sliding-window check: can any 5-consecutive-rank window be filled with present ranks + wilds? */
function _windowCheck(rankIdxSet, jokerCount) {
  for (let lo = -1; lo <= 8; lo++) {
    let covered = 0;
    for (let r = lo; r <= lo + 4; r++) {
      if (rankIdxSet.has(r)) {
        covered++;
      }
    }
    if (covered + jokerCount >= 5) {
      return true;
    }
  }
  return false;
}

function _checkFullHouse(regular, jokerCount) {
  const rankNums = _countByRank(regular);
  const ranks = Object.keys(rankNums);
  if (ranks.length === 0) {
    return false;
  }

  for (const tripsRank of ranks) {
    const jAfterTrips = jokerCount - Math.max(0, 3 - rankNums[tripsRank]);
    if (jAfterTrips < 0) {
      continue;
    }
    if (ranks.length === 1 && jAfterTrips >= 2) {
      return true;
    }
    for (const pairRank of ranks) {
      if (pairRank !== tripsRank && jAfterTrips >= Math.max(0, 2 - rankNums[pairRank])) {
        return true;
      }
    }
  }
  return false;
}

function _checkTwoPair(regular, jokerCount) {
  const values = Object.values(_countByRank(regular));
  const pairs = values.filter((n) => n >= 2).length;
  if (pairs >= 2) {
    return true;
  }
  if (pairs >= 1 && jokerCount >= 1) {
    return true;
  }
  const singles = values.filter((n) => n === 1).length;
  return pairs === 0 && jokerCount >= 2 && singles >= 2;
}

function _checkJacksOrBetter(regular, jokerCount) {
  const rankNums = _countByRank(regular);
  for (const r of HIGH_RANKS) {
    if ((rankNums[r] ?? 0) >= 2) {
      return true;
    }
    if (jokerCount >= 1 && (rankNums[r] ?? 0) >= 1) {
      return true;
    }
  }
  return jokerCount >= 2;
}
