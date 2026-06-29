/**
 * NpcSheet — full character sheet without the Fate Chip widget.
 *
 * @license MIT
 */

import { BaseCharacterSheet } from "../_base/base-character-sheet.mjs";

export class NpcSheet extends BaseCharacterSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["npc"],
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // NPCs have no chips — clear the widget context so templates render nothing.
    context.chips = [];
    return context;
  }
}
