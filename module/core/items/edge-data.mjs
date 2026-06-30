/**
 * EdgeDataModel — item data model for Edge items.
 *
 * Edges cost build points (1–5) and grant mechanical benefits. dlc p.39-44.
 *
 * @license MIT
 */

// DLC does not assign category labels to edges (p.63-70). The field is kept
// for user convenience / sheet filtering but is not required.
const EDGE_CATEGORIES = ["physical", "mental", "social", "professional", "arcane"];

export class EdgeDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      // Build-point cost. dlc p.39: edges cost 0–5 points each. Veteran o' the
      // Weird West costs 0 (grants 15 extra points at a narrative price). dlc p.70.
      cost: new f.NumberField({ integer: true, min: 0, max: 5, initial: 1 }),
      // Optional broad category for sheet filtering — not present in the rulebook.
      category: new f.StringField({
        required: false,
        choices: EDGE_CATEGORIES,
        initial: "",
        blank: true,
      }),
      // Optional prerequisites (free text, e.g. "Strength 2d8+, not Big 'Un").
      requirements: new f.ArrayField(new f.StringField()),
      // Mechanical effect only — no flavor prose.
      description: new f.HTMLField(),
    };
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
