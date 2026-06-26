/**
 * BlessedDataModel — archetype data model for the Blessed.
 *
 * Extends the base character with faith Aptitude tracking and a sin state.
 * Faith is an Aptitude associated with Spirit (dlc p.44; fb p.26).
 * Faith level determines how many dice are rolled vs a miracle's fixed TN.
 *
 * New fields:
 *   faith          — level + modifier for the faith Aptitude.
 *   sinPending     — true when a sin check is queued after an action.
 *   faithDeniedUntil — ISO timestamp when the patron restores miracle access.
 *   faithDeniedSeverity — "none" | "minor" | "major" | "mortal"
 *
 * Sources: dlc p.44, p.177-181; fb p.26, p.35-36, p.103-105.
 *
 * @license MIT
 */

import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

const SIN_SEVERITIES = ["none", "minor", "major", "mortal"];

export class BlessedDataModel extends BaseCharacterDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    const base = super.defineSchema();

    // Faith Aptitude (Spirit-based). dlc p.44; fb p.26.
    base.faith = new f.SchemaField({
      level: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      modifier: new f.NumberField({ integer: true, initial: 0 }),
    });

    // Awaiting sin resolution — set by invoking a miracle sinfully or committing a sin.
    base.sinPending = new f.BooleanField({ initial: false });

    // ISO timestamp until which the patron denies miracle access. fb p.103-104.
    base.faithDeniedUntil = new f.StringField({ initial: "" });

    // Severity of the active denial (determines duration). fb p.103-104.
    base.faithDeniedSeverity = new f.StringField({
      choices: SIN_SEVERITIES,
      initial: "none",
    });

    return base;
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
