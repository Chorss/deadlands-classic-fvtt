/**
 * CombatantHandDialog — shows a combatant's Action Card hand.
 *
 * Allows playing a card (advances initiative to the next highest card) and
 * sleeving one card (kept face-down for interrupt actions). `dlc` p.116-117.
 *
 * Singleton per combatant: calling open() on an already-open dialog brings it
 * to the front instead of spawning a second window.
 */

import { DeadlandsCombat } from "./deadlands-combat.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Singleton registry: combatant.id → open dialog instance */
const _openDialogs = new Map();

export class CombatantHandDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {DeadlandsCombatant} combatant */
  constructor(combatant, options = {}) {
    super(options);
    this._combatant = combatant;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["deadlands-classic", "dlc-hand-dialog"],
    window: { minimizable: false },
    position: { width: 320, height: "auto" },
    actions: {
      playCard: CombatantHandDialog.#onPlayCard,
      sleeveCard: CombatantHandDialog.#onSleeveCard,
    },
  };

  /** @override */
  static PARTS = {
    hand: { template: "templates/dialogs/combatant-hand.hbs" },
  };

  /** @override */
  get title() {
    return game.i18n.format("DEADLANDS.Combat.Hand.Title", { name: this._combatant.name });
  }

  /** @override */
  async _prepareContext(_options) {
    const hand = this._combatant.hand.map((c) => this.#cardContext(c));
    const sleevedCard = this._combatant.sleevedCard
      ? this.#cardContext(this._combatant.sleevedCard)
      : null;
    return { name: this._combatant.name, hand, sleevedCard };
  }

  #cardContext(card) {
    return {
      ...card,
      label: DeadlandsCombat.cardLabel(card),
      isJoker: !!card.joker,
      isRedJoker: card.joker === "red",
      isBlackJoker: card.joker === "black",
    };
  }

  /** @override */
  async _onClose(options) {
    _openDialogs.delete(this._combatant.id);
    return super._onClose(options);
  }

  static async #onPlayCard(_event, target) {
    const { rank, suit, joker } = target.dataset;
    await this._combatant.playCard({
      rank: rank || null,
      suit: suit || null,
      joker: joker || null,
    });
    this.render();
  }

  static async #onSleeveCard(_event, target) {
    const { rank, suit } = target.dataset;
    await this._combatant.sleeveCard({ rank: rank || null, suit: suit || null, joker: null });
    this.render();
  }

  /**
   * Open (or focus) the hand dialog for the given combatant.
   * @param {DeadlandsCombatant} combatant
   * @returns {CombatantHandDialog}
   */
  static open(combatant) {
    const existing = _openDialogs.get(combatant.id);
    if (existing?.rendered) {
      existing.bringToFront();
      return existing;
    }
    const dialog = new CombatantHandDialog(combatant);
    _openDialogs.set(combatant.id, dialog);
    dialog.render({ force: true });
    return dialog;
  }
}
