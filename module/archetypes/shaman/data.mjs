/**
 * ShamanDataModel — archetype data model for the Shaman.
 *
 * Extends the base character with ritual Aptitude tracking and Appeasement
 * point storage. Appeasement is earned through rituals and spent on favors.
 * Without the Guardian Spirit Edge, points cannot be stored (use-it-or-lose-it).
 * ghost-dancers p.50, 56-57; dlc p.182-192.
 *
 * New fields:
 *   ritual         — level + modifier for the ritual Aptitude.
 *   guardianSpirit — Edge level (0 = no guardian spirit); determines max storage.
 *   appeasement    — { current, max } Appeasement point pool.
 *
 * @license MIT
 */

import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

export class ShamanDataModel extends BaseCharacterDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    const base = super.defineSchema();

    // Ritual Aptitude — used in place of faith for spirit-related rolls. dlc p.185.
    base.ritual = new f.SchemaField({
      level: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      modifier: new f.NumberField({ integer: true, initial: 0 }),
    });

    // Guardian Spirit Edge level. 0 = no spirit; max appeasement storage = this value.
    // ghost-dancers p.50.
    base.guardianSpirit = new f.NumberField({ integer: true, min: 0, max: 5, initial: 0 });

    // Appeasement point pool. Max = guardianSpirit level (0 without the edge).
    // ghost-dancers p.50, 57.
    base.appeasement = new f.SchemaField({
      current: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      max: new f.NumberField({ integer: true, min: 0, initial: 0 }),
    });

    return base;
  }

  /** Keep appeasement.max in sync with guardianSpirit level. */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.appeasement.max = this.guardianSpirit;
    this.appeasement.current = Math.min(this.appeasement.current, this.appeasement.max);
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
