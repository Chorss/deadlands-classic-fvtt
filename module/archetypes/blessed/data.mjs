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
 *   faithDeniedUntil — game.time.worldTime (seconds) when the patron restores
 *     miracle access; 0 when no denial is active. fb p.103-104 doesn't specify
 *     real-world vs in-game time, so this uses the world clock (story time).
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

    // game.time.worldTime (seconds) until which the patron denies miracle
    // access; 0 = no active denial. fb p.103-104.
    base.faithDeniedUntil = new f.NumberField({ integer: true, min: 0, initial: 0 });

    // Severity of the active denial (determines duration). fb p.103-104.
    base.faithDeniedSeverity = new f.StringField({
      choices: SIN_SEVERITIES,
      initial: "none",
    });

    return base;
  }

  /** @param {object} source */
  static migrateData(source) {
    // faithDeniedUntil was a StringField (unused) prior to 0.3.3 — coerce any
    // leftover string value to the NumberField default instead of throwing.
    if (typeof source.faithDeniedUntil === "string") {
      source.faithDeniedUntil = 0;
    }
    return super.migrateData(source);
  }
}
