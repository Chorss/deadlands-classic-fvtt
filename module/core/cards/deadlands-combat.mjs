/**
 * DeadlandsCombat — Combat subclass using card-based initiative.
 *
 * Overrides `rollInitiative` to deal Action Cards from the ActionDeck instead
 * of rolling a die. Each combatant's Quickness trait is rolled vs TN 5 to
 * determine card count; the result is stored on DeadlandsCombatant flags and
 * `Combatant#initiative` is set to the numeric encoding of the highest card.
 *
 * Joker effects (`dlc` p.118):
 *   Red Joker  — acts at any time; combatant draws a random Fate Chip.
 *   Black Joker— combatant loses their sleeved card; Marshal draws a Fate Chip;
 *                deck reshuffles at end of round.
 *
 * @see module/core/cards/action-deck.mjs   (deck state + pure helpers)
 * @see module/core/cards/deadlands-combatant.mjs  (hand storage)
 * @license MIT
 */

import { grantChips } from "../chips/chip-widget.mjs";
import { FatePot } from "../chips/fate-pot.mjs";
import { DEADLANDS } from "../config.mjs";
import { rollExplodingPool } from "../dice/exploding-roll.mjs";
import { ActionDeck, quicknessCardCount } from "./action-deck.mjs";

export class DeadlandsCombat extends Combat {
  /**
   * Deal Action Cards to combatants instead of rolling dice. `dlc` p.116.
   * @override
   * @param {string|string[]} ids — combatant ID(s)
   * @param {object} [options]
   * @returns {Promise<this>}
   */
  async rollInitiative(ids, _options = {}) {
    const idList = Array.isArray(ids) ? ids : [ids];
    const combatants = idList.map((id) => this.combatants.get(id)).filter(Boolean);
    if (!combatants.length) return this;

    await ActionDeck.initialize(this);

    for (const combatant of combatants) {
      const count = await this._quicknessCardCount(combatant);
      if (count === 0) {
        await combatant.setHand([]);
        await this._postSystemMessage(
          game.i18n.format("DEADLANDS.Combat.Initiative.Bust", { name: combatant.name })
        );
        continue;
      }
      const dealt = await ActionDeck.deal(this, count);
      const hand = await this._resolveJokers(dealt, combatant);
      await combatant.setHand(hand);
    }

    return this;
  }

  /**
   * Roll Quickness vs TN 5 and return the number of Action Cards to deal.
   * `dlc` p.116: bust → 0; 1 (base) + 1 per raise, capped at MAX_ACTION_CARDS.
   * @param {DeadlandsCombatant} combatant
   * @returns {Promise<number>}
   */
  async _quicknessCardCount(combatant) {
    const actor = combatant.actor;
    if (!actor?.system?.quickness) return 1;
    const { dieCount = 1, dieType = "d6" } = actor.system.quickness;
    const result = rollExplodingPool(dieCount, dieType, { tn: DEADLANDS.INITIATIVE_TN });
    return quicknessCardCount(result);
  }

  /**
   * Process jokers in a dealt hand: apply effects and strip Black Jokers.
   * Red Joker stays in hand (acts at any time). `dlc` p.118.
   * @param {object[]} cards
   * @param {DeadlandsCombatant} combatant
   * @returns {Promise<object[]>} resolved hand (Black Joker removed)
   */
  async _resolveJokers(cards, combatant) {
    const hand = [];
    for (const card of cards) {
      if (card.joker === "black") {
        await this._applyBlackJoker(combatant);
        // Black Joker is discarded, not added to hand. dlc p.118.
      } else {
        if (card.joker === "red") await this._applyRedJoker(combatant);
        hand.push(card);
      }
    }
    return hand;
  }

  /**
   * Black Joker effects: discard sleeve, Marshal draws a chip, flag reshuffle.
   * `dlc` p.118.
   * @param {DeadlandsCombatant} combatant
   */
  async _applyBlackJoker(combatant) {
    await combatant.discardSleevedCard();
    await ActionDeck.markReshuffleAtRoundEnd(this);
    const [chip] = await FatePot.drawBlind(1);
    await this._postSystemMessage(
      game.i18n.format("DEADLANDS.Combat.Initiative.BlackJoker", {
        name: combatant.name,
        chip: chip ?? "—",
      })
    );
  }

  /**
   * Red Joker effect: the combatant draws a random Fate Chip from the pot.
   * `dlc` p.118.
   * @param {DeadlandsCombatant} combatant
   */
  async _applyRedJoker(combatant) {
    const [chip] = await FatePot.drawBlind(1);
    if (chip && combatant.actor) {
      await grantChips(combatant.actor, [chip]);
    }
    await this._postSystemMessage(
      game.i18n.format("DEADLANDS.Combat.Initiative.RedJoker", {
        name: combatant.name,
        chip: chip ?? "—",
      })
    );
  }

  /**
   * Post a chat message attributed to the system (no actor speaker).
   * @param {string} content — already-localised HTML string
   */
  async _postSystemMessage(content) {
    await ChatMessage.create({
      content,
      speaker: { alias: game.i18n.localize("DEADLANDS.System.Title") },
    });
  }

  /**
   * Clear all hands, execute any pending reshuffle, then advance the round.
   * `dlc` p.118: deck reshuffles at end of the round in which a Black Joker appeared.
   * @override
   */
  async nextRound() {
    for (const combatant of this.combatants) {
      if (typeof combatant.clearHand === "function") await combatant.clearHand();
    }
    const reshuffled = await ActionDeck.maybeReshuffleAtRoundEnd(this);
    if (reshuffled) {
      await this._postSystemMessage(game.i18n.localize("DEADLANDS.Combat.Round.Reshuffle"));
    }
    return super.nextRound();
  }

  /**
   * Localised label for a card object, used by the tracker and chat messages.
   * @param {{ rank: string|null, suit: string|null, joker: string|null }} card
   * @returns {string}
   */
  static cardLabel(card) {
    if (card.joker === "red") return game.i18n.localize("DEADLANDS.Combat.Card.RedJoker");
    if (card.joker === "black") return game.i18n.localize("DEADLANDS.Combat.Card.BlackJoker");
    const rankKey = `DEADLANDS.Combat.Card.Rank.${card.rank}`;
    const suitKey = `DEADLANDS.Combat.Card.Suit.${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)}`;
    const rank = game.i18n.has(rankKey) ? game.i18n.localize(rankKey) : card.rank;
    const suit = game.i18n.localize(suitKey);
    return game.i18n.format("DEADLANDS.Combat.Card.Label", { rank, suit });
  }
}
