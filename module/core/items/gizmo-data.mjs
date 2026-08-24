/**
 * GizmoDataModel — item data model for Mad Scientist gizmo items.
 *
 * A gizmo goes through four creation steps: theory (narrative), blueprint
 * (science roll + poker hand), components (narrative), construction (tinkerin'
 * roll). The blueprint hand and construction TN come from the Gizmo
 * Construction Table (dlc p.168-169). Reliability starts at 10; each raise on
 * the blueprint or construction roll adds +2, max 19. dlc p.170.
 *
 * @license MIT
 */

import { POKER_HAND_RANKS } from "../dice/poker-hand-evaluator.mjs";

/**
 * Gizmo power source categories — used to determine which Malfunction sub-table
 * applies. dlc p.247-249.
 */
export const GIZMO_POWER_TYPES = ["mechanical", "muscleOrMechanical", "steamOrGhostRock"];

/**
 * Gizmo Construction Table: blueprint (minimum poker hand) → construction TN.
 * dlc p.168-169. The lowest tier the table offers is a pair of Jacks or better;
 * there is no rung below it, so the table carries no plain pair or ace row.
 * @type {Record<string, number>}
 */
export const GIZMO_CONSTRUCTION_TABLE = {
  jacks: 5,
  twoPair: 7,
  threeOfAKind: 9,
  straight: 11,
  flush: 13,
  fullHouse: 15,
  fourOfAKind: 17,
  straightFlush: 19,
  royalFlush: 21,
};

export class GizmoDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      // Minimum poker hand from the blueprint draw. dlc p.168-169. Choices
      // stay the full POKER_HAND_RANKS enum (shared with hexes, which do use
      // ace/pair), but the default is "jacks" — the Construction Table's
      // actual lowest tier; ace/pair have no construction TN at all.
      blueprintHand: new f.StringField({
        choices: POKER_HAND_RANKS,
        initial: "jacks",
      }),
      // TN for the tinkerin' (construction) roll. dlc p.170.
      constructionTN: new f.NumberField({ integer: true, min: 3, initial: 5 }),
      // Current Reliability rating. Base 10; +2 per raise on blueprint or construction. dlc p.170.
      reliability: new f.NumberField({ integer: true, min: 1, max: 19, initial: 10 }),
      // Power source category for Malfunction sub-table selection. dlc p.247-249.
      powerType: new f.StringField({
        choices: GIZMO_POWER_TYPES,
        initial: "mechanical",
      }),
      // The science Aptitude concentration used to devise this blueprint.
      scienceConcentration: new f.StringField({ initial: "" }),
      // Aptitude/trait used to activate the gizmo (free text: "shootin': gatling", etc.).
      useAptitude: new f.StringField({ initial: "" }),
      // Casting/use time (free text).
      speed: new f.StringField({ initial: "1 action" }),
      // Effect duration (free text).
      duration: new f.StringField({ initial: "instant" }),
      // Range or area (free text).
      range: new f.StringField({ initial: "see description" }),
      // Tracks blueprint status: "none" | "devised" | "failed"
      blueprintStatus: new f.StringField({
        choices: ["none", "devised", "failed"],
        initial: "none",
      }),
      // Whether the gizmo has been successfully constructed.
      constructed: new f.BooleanField({ initial: false }),
      // GM/player description. No rulebook prose.
      description: new f.HTMLField(),
    };
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
