/**
 * MadScientistDataModel — archetype data model for the Mad Scientist.
 *
 * Extends the base character with Mad Science Aptitude tracking. Mad Science
 * (Knowledge-based, dlc p.46) is its own Aptitude, distinct from the standard
 * Science Aptitude ("regular old science Aptitude just won't cut it" — dlc
 * p.46) — it is used to devise blueprints; construction uses tinkerin'
 * (Smarts-based, dlc p.51), which is a *standard* core Aptitude
 * (`APTITUDES.smarts.tinkerin` in `core/config.mjs`) tracked on the base
 * schema at `system.traits.smarts.aptitudes.tinkerin` — Mad Scientist adds no
 * schema field for it, it just reads the standard one in `mechanics.mjs`.
 *
 * New fields:
 *   madScience — level + modifier for the Mad Science Aptitude (the "mad
 *     science roll"). Archetype-exclusive by design (excluded from core
 *     APTITUDES, unlike tinkerin').
 *
 * @license MIT
 */

import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

export class MadScientistDataModel extends BaseCharacterDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    const base = super.defineSchema();

    // Mad Science Aptitude (Knowledge-based) — used for blueprint devising. dlc p.46, p.168.
    base.madScience = new f.SchemaField({
      level: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      modifier: new f.NumberField({ integer: true, initial: 0 }),
    });

    return base;
  }

  /**
   * `tinkerin` used to be a flat field here, duplicating the standard
   * Aptitude tracked at `traits.smarts.aptitudes.tinkerin`. Fold any legacy
   * value into the standard location (max of the two, in case both were
   * touched) and drop the flat field so it doesn't linger as dead data.
   * @param {object} source
   */
  static migrateData(source) {
    const legacy = source.tinkerin;
    if (legacy && typeof legacy === "object") {
      source.traits ??= {};
      source.traits.smarts ??= {};
      source.traits.smarts.aptitudes ??= {};
      const aptitudes = source.traits.smarts.aptitudes;
      const current = aptitudes.tinkerin ?? {};
      aptitudes.tinkerin = {
        ...current,
        level: Math.max(current.level ?? 0, legacy.level ?? 0),
        modifier: current.modifier || legacy.modifier || 0,
      };
      delete source.tinkerin;
    }
    return super.migrateData(source);
  }
}
