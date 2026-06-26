/**
 * MiracleDataModel — item data model for Blessed miracle items.
 *
 * Each miracle has a fixed TN (fb p.35; dlc p.180). The Blessed makes a faith
 * roll (faith level × Spirit die) against that TN — no card draw, no poker hand.
 * Using a miracle sinfully may carry a sinSeverity that triggers the sin mechanic
 * (fb p.103-104).
 *
 * @license MIT
 */

const SIN_SEVERITIES = ["none", "minor", "major", "mortal"];

export class MiracleDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      // Fixed TN the faith roll must meet. dlc p.180.
      tn: new f.NumberField({ integer: true, min: 1, initial: 5 }),
      // Casting time (free text). fb p.35.
      speed: new f.StringField({ initial: "1 action" }),
      // Effect duration (free text). fb p.35.
      duration: new f.StringField({ initial: "instant" }),
      // Range (free text: "touch", "10 yards", etc.). fb p.35.
      range: new f.StringField({ initial: "touch" }),
      // Sin severity if this miracle is invoked sinfully. fb p.103-104.
      sinSeverity: new f.StringField({
        choices: SIN_SEVERITIES,
        initial: "none",
      }),
      // GM/player description of the miracle effect. No rulebook prose.
      description: new f.HTMLField(),
    };
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
