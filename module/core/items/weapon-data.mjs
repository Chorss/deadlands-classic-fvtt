/**
 * WeaponDataModel — item data model for Weapon items.
 *
 * Covers ranged and melee weapons per the dlc weapon tables (p.79-82).
 *
 * @license MIT
 */

// Exported for reuse by WeaponSheet, which builds <select> choices from these.
export const WEAPON_CATEGORIES = [
  "automatics",
  "carbines",
  "derringers",
  "pistolSA",
  "pistolDA",
  "rifles",
  "shotguns",
  "otherRanged",
  "meleeWeapon",
  "other",
];

export const RANGE_TYPES = ["melee", "ranged"];

export class WeaponDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      // Table grouping from dlc p.79-82.
      category: new f.StringField({
        required: false,
        choices: WEAPON_CATEGORIES,
        initial: "",
        blank: true,
      }),
      rangeType: new f.StringField({ choices: RANGE_TYPES, initial: "ranged", blank: false }),
      // Damage notation (e.g. "3d8", "STR+1d6") or the literal "Special".
      damage: new f.StringField({ initial: "", blank: true }),
      // Range Increment in yards/feet; divide actual distance by this. dlc p.80.
      // null for melee weapons.
      range: new f.NumberField({ integer: true, nullable: true, initial: null }),
      // Ammo capacity. null for melee weapons.
      shots: new f.NumberField({ integer: true, nullable: true, initial: null }),
      rof: new f.NumberField({ integer: true, min: 1, initial: 1 }),
      // Caliber / ammo type (dlc p.82: "Ammo").
      ammoType: new f.StringField({ initial: "", blank: true }),
      // Defense Bonus — melee weapons only. dlc p.82.
      defense: new f.StringField({ initial: "", blank: true }),
      // Rulebook price column mixes currency ("$1,500") and the literal "Special".
      price: new f.StringField({ initial: "", blank: true }),
      description: new f.HTMLField(),
    };
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
