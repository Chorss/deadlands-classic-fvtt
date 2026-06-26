/**
 * NpcDataModel — full character model without Fate Chips.
 *
 * NPCs have the same 10 Traits, Aptitudes, wound track and Wind as PCs,
 * but the Marshal doesn't give them Fate Chips. Chips are excluded from the
 * schema so they never appear in the document data.
 *
 * @license MIT
 */

import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

export class NpcDataModel extends BaseCharacterDataModel {
  static defineSchema() {
    const schema = super.defineSchema();
    // NPCs have no Fate Chips. dlc p.146 (chips are for players only).
    delete schema.chips;
    return schema;
  }
}
