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
    // Compact window (A3) — no Fate Chips, no gear tab clutter to fill 740px.
    position: { width: 460 },
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // NPCs have no chips — clear the widget context so templates render nothing.
    context.chips = [];
    return context;
  }
}
