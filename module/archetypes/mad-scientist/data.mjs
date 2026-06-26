/**
 * MadScientistDataModel — archetype data model for the Mad Scientist.
 *
 * Extends the base character with science and tinkerin' Aptitude tracking.
 * Science (Cognition-based) is used to devise blueprints; tinkerin' (Deftness-
 * based) is used to construct gizmos. dlc p.168-170.
 *
 * New fields:
 *   madScience  — level + modifier for the science Aptitude (the "mad science roll").
 *   tinkerin    — level + modifier for the tinkerin' Aptitude.
 *
 * @license MIT
 */

import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

export class MadScientistDataModel extends BaseCharacterDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    const base = super.defineSchema();

    // Science Aptitude (Cognition-based) — used for blueprint devising. dlc p.168.
    base.madScience = new f.SchemaField({
      level: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      modifier: new f.NumberField({ integer: true, initial: 0 }),
    });

    // Tinkerin' Aptitude (Deftness-based) — used for construction. dlc p.170.
    base.tinkerin = new f.SchemaField({
      level: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      modifier: new f.NumberField({ integer: true, initial: 0 }),
    });

    return base;
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
