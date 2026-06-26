/**
 * DeadlandsCombatant — Combatant subclass tracking card-based initiative.
 *
 * Each combatant holds a `hand` (cards drawn for this round) and an optional
 * `sleevedCard` (kept face-down for interrupt actions). Both are stored as
 * Combat document flags scoped to this combatant.
 *
 * `Combatant#initiative` is set to `cardValue(highestCard)`. Foundry's default
 * descending sort makes the highest-valued card act first, matching Deadlands'
 * "Ace before 2" order. Suit tiebreaker is encoded in the value itself
 * (♠ > ♥ > ♦ > ♣). `dlc` p.116-117.
 *
 * @license MIT
 */

import { cardValue, compareCards } from "./action-deck.mjs";

const FLAG_SCOPE = "deadlands-classic";

export class DeadlandsCombatant extends Combatant {
  /**
   * Cards currently in hand, sorted highest-initiative first.
   * @returns {object[]}
   */
  get hand() {
    return this.getFlag(FLAG_SCOPE, "hand") ?? [];
  }

  /**
   * Card kept up the sleeve for interrupt actions, or null. `dlc` p.117.
   * @returns {object|null}
   */
  get sleevedCard() {
    return this.getFlag(FLAG_SCOPE, "sleevedCard") ?? null;
  }

  /**
   * The card that determines this combatant's place in the initiative order.
   * @returns {object|null}
   */
  get highestCard() {
    const { hand } = this;
    return hand.length ? [...hand].sort(compareCards)[0] : null;
  }

  /**
   * Replace the hand with a new array of cards and sync `Combatant#initiative`.
   * Initiative = cardValue of the highest card, or null when the hand is empty.
   * @param {object[]} cards
   */
  async setHand(cards) {
    await this.setFlag(FLAG_SCOPE, "hand", cards);
    const top = cards.length ? [...cards].sort(compareCards)[0] : null;
    await this.update({ initiative: top ? cardValue(top) : null });
  }

  /**
   * Move a card from the hand to the sleeve (kept for an interrupt).
   * Jokers cannot be sleeved. `dlc` p.117.
   * @param {object} card — must be in the current hand
   * @returns {Promise<boolean>} false if the card is a joker (no-op + warning)
   */
  async sleeveCard(card) {
    if (card.joker) {
      ui.notifications?.warn(game.i18n.localize("DEADLANDS.Combat.Initiative.NoSleeveJoker"));
      return false;
    }
    const hand = this.hand.filter((c) => !(c.rank === card.rank && c.suit === card.suit));
    await this.setFlag(FLAG_SCOPE, "sleevedCard", card);
    await this.setHand(hand);
    return true;
  }

  /**
   * Discard the sleeved card without returning it to hand (Black Joker penalty).
   * `dlc` p.118.
   */
  async discardSleevedCard() {
    await this.setFlag(FLAG_SCOPE, "sleevedCard", null);
  }

  /**
   * Remove one card from the hand (it was played this segment) and recalculate
   * initiative from the next highest card.
   * @param {object} card
   */
  async playCard(card) {
    const hand = this.hand.filter(
      (c) => !(c.rank === card.rank && c.suit === card.suit && c.joker === card.joker)
    );
    await this.setHand(hand);
  }

  /**
   * Discard the entire hand and the sleeved card at round end.
   */
  async clearHand() {
    await this.setFlag(FLAG_SCOPE, "hand", []);
    await this.setFlag(FLAG_SCOPE, "sleevedCard", null);
    await this.update({ initiative: null });
  }
}
