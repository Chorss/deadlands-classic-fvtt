/**
 * HindranceDataModel — item data model for Hindrance items.
 *
 * Hindrances give the character build points back (Minor = 1 pt, Major = 3 pts)
 * in exchange for roleplay or mechanical drawbacks. dlc p.44-48.
 *
 * @license MIT
 */

export class HindranceDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      // Build points returned to the player (1–5). Variable-cost hindrances
      // store the minimum tier; the chosen tier is noted in the description.
      // dlc p.52-62.
      points: new f.NumberField({ integer: true, min: 1, max: 5, initial: 1 }),
      // Mechanical effect only — no flavor prose (see implementation-plan §12 copyright note).
      description: new f.HTMLField(),
    };
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
