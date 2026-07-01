/**
 * BaseCharacterDataModel — the shared TypeDataModel for every player archetype.
 *
 * Holds the fields common to all characters: the 10 Traits (each with its die
 * pool and nested Aptitudes), the 8-slot wound track, Wind, Fate Chips and the
 * derived secondary stats. Archetype data models extend this and add their
 * arcane fields (Phases 9–11). Edges and Hindrances are embedded Items, not
 * schema fields, so they are absent here by design.
 *
 * Mechanics verified against `dlc`: Traits p.37-38, Aptitudes p.41-51,
 * Wind/Pace/Size/Grit p.40, wound levels p.139, wound penalty p.140.
 *
 * @see docs/v14-api-notes.md (TypeDataModel patterns)
 * @license MIT
 */

import { APTITUDES, DIE_TYPES, HIT_LOCATIONS, TRAITS, WOUND_MAX } from "../../core/config.mjs";
import { OverlayRegistry } from "../../core/overlay-registry.mjs";
import { highestWoundPenalty } from "../../core/wounds/wound-track.mjs";

/** Numeric face value of a die-type string ("d8" → 8). */
function dieFace(dieType) {
  const n = Number.parseInt(String(dieType).replace(/^d/, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export class BaseCharacterDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;

    /** A trait's nested Aptitudes schema, built from the config grouping. */
    const aptitudesField = (traitId) => {
      const group = APTITUDES[traitId] ?? {};
      const fields = {};
      for (const aptId of Object.keys(group)) {
        fields[aptId] = new f.SchemaField({
          level: new f.NumberField({ integer: true, min: 0, initial: 0 }),
          modifier: new f.NumberField({ integer: true, initial: 0 }),
        });
      }
      return new f.SchemaField(fields);
    };

    // 10 Traits — each a die pool (count + type) plus its nested Aptitudes.
    const traitFields = {};
    for (const traitId of Object.keys(TRAITS)) {
      traitFields[traitId] = new f.SchemaField({
        dieCount: new f.NumberField({ integer: true, min: 1, initial: 1 }),
        dieType: new f.StringField({ required: true, choices: [...DIE_TYPES], initial: "d6" }),
        modifier: new f.NumberField({ integer: true, initial: 0 }),
        aptitudes: aptitudesField(traitId),
      });
    }

    // 8-slot wound track (limbs split L/R) — each holds a severity 0–5.
    const woundFields = {};
    for (const loc of Object.keys(HIT_LOCATIONS)) {
      woundFields[loc] = new f.SchemaField({
        severity: new f.NumberField({ integer: true, min: 0, max: WOUND_MAX, initial: 0 }),
      });
    }

    const base = {
      biography: new f.HTMLField(),
      traits: new f.SchemaField(traitFields),
      wounds: new f.SchemaField(woundFields),
      wind: new f.SchemaField({
        value: new f.NumberField({ integer: true, min: 0, initial: 0 }),
        max: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      }),
      chips: new f.SchemaField({
        white: new f.NumberField({ integer: true, min: 0, initial: 0 }),
        red: new f.NumberField({ integer: true, min: 0, initial: 0 }),
        blue: new f.NumberField({ integer: true, min: 0, initial: 0 }),
        legend: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      }),
      // Secondary/derived stats. Stored so Edges/Hindrances (ActiveEffects) can
      // tweak them; the base values are recomputed in prepareDerivedData.
      pace: new f.NumberField({ integer: true, min: 0, initial: 6 }),
      size: new f.NumberField({ integer: true, min: 1, initial: 6 }),
      grit: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      bounty: new f.NumberField({ integer: true, initial: 0 }),
      // Highest current wound penalty, computed in prepareDerivedData (read-only).
      woundModifier: new f.NumberField({ integer: true, initial: 0 }),
    };

    // Merge extra fields from every registered overlay (e.g. harrowed.*).
    // All overlay manifests are imported before the init hook fires, and
    // defineSchema() is called lazily on first document instantiation — so the
    // registry is already populated at this point. bod p.10-12, dlc p.194.
    for (const overlay of OverlayRegistry.all()) {
      if (typeof overlay.schemaFields === "function") {
        Object.assign(base, overlay.schemaFields());
      }
    }

    return base;
  }

  /** Recompute derived secondary stats after base data + active effects. */
  prepareDerivedData() {
    // Wind = Vigor die value + Spirit die value (face values). dlc p.40.
    this.wind.max = dieFace(this.traits.vigor?.dieType) + dieFace(this.traits.spirit?.dieType);

    // Pace = Nimbleness die value. dlc p.40. (Edges/Hindrances adjust via AE.)
    this.pace = dieFace(this.traits.nimbleness?.dieType);

    // Wound penalty = the single highest wound level, NOT the sum, with the
    // three guts sub-locations pooled as one severity. dlc p.139-140.
    this.woundModifier = highestWoundPenalty(this.wounds);
  }

  /**
   * Migration entry point — seeded from day one so 0.1→0.2 schema changes do
   * not break existing worlds (plan §8). No transforms yet.
   * @param {object} source
   */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
