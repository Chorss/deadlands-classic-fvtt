/**
 * HucksterDataModel — archetype data model for the Huckster.
 *
 * Extends the base character with hexslingin' aptitude storage and the card-draw
 * state used during hex casting. The hexslingin' aptitude is stored as a flat
 * schema field (not nested under system.traits.spirit.aptitudes) to avoid
 * mutating the shared base schema; the Hexes tab renders it separately.
 *
 * New fields (hnh p.33, dlc p.157):
 *   hexslingin — level + modifier for the hexslingin' aptitude.
 *   lastDraw   — cards drawn on the most recent hex cast (for sheet display).
 *   backlashPending — true when a backlash resolution is awaiting GM input.
 *
 * @license MIT
 */

import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

export class HucksterDataModel extends BaseCharacterDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    const base = super.defineSchema();

    base.hexslingin = new f.SchemaField({
      level: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      modifier: new f.NumberField({ integer: true, initial: 0 }),
    });

    // The cards drawn on the last hex attempt (persisted so the sheet can re-display them).
    base.lastDraw = new f.ArrayField(new f.ObjectField());

    // Awaiting backlash: set to true after a bust or a Black Joker draw so the GM
    // is prompted to resolve the Extended Backlash Table. hnh p.96-97.
    base.backlashPending = new f.BooleanField({ initial: false });

    return base;
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
