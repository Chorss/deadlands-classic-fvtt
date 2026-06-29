/**
 * FavorDataModel — item data model for Shaman favor items.
 *
 * Favors are granted by the spirits in exchange for Appeasement points earned
 * through rituals. Each favor belongs to one of the six Medicine Ways and is
 * unlocked through a specific ritual type. ghost-dancers p.56-70; dlc p.182-192.
 *
 * @license MIT
 */

/** The six Medicine Ways. ghost-dancers p.61. */
const MEDICINE_WAYS = ["earth", "water", "fire", "air", "spirit", "guardian"];

/**
 * Ritual types available as Aptitude concentrations. ghost-dancers p.71-76.
 * Each concentration has its own associated Trait (handled in mechanics).
 */
const RITUAL_TYPES = [
  "dance",
  "fast",
  "peyote",
  "bodyPainting",
  "pledge",
  "scar",
  "animalSacrifice",
  "spiritSong",
];

export class FavorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      // Which Medicine Way this favor belongs to. ghost-dancers p.61.
      medicine: new f.StringField({
        choices: MEDICINE_WAYS,
        initial: "earth",
      }),
      // The ritual type used to earn Appeasement for this favor. ghost-dancers p.71.
      ritualType: new f.StringField({
        choices: RITUAL_TYPES,
        initial: "dance",
      }),
      // Associated Trait for the ritual roll. ghost-dancers p.71-76.
      ritualTrait: new f.StringField({ initial: "nimbleness" }),
      // Appeasement point cost to invoke this favor. dlc p.184.
      appeasementCost: new f.NumberField({ integer: true, min: 1, initial: 1 }),
      // TN for the ritual roll. dlc p.185.
      ritualTN: new f.NumberField({ integer: true, min: 3, initial: 5 }),
      // Casting time (free text).
      speed: new f.StringField({ initial: "1 ritual" }),
      // Effect duration (free text).
      duration: new f.StringField({ initial: "instant" }),
      // Range (free text).
      range: new f.StringField({ initial: "self" }),
      // GM/player description. No rulebook prose.
      description: new f.HTMLField(),
    };
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
