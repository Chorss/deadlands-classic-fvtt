/**
 * HexDataModel — item data model for Huckster hex items.
 *
 * A hex has five canonical fields (hnh p.33, dlc p.158): Trait, Hand, Speed,
 * Duration, and Range, plus a free-text description. The `hand` field stores
 * the minimum poker hand required to cast the hex (compared against the draw
 * using the poker-hand-evaluator).
 *
 * @license MIT
 */

import { POKER_HAND_RANKS } from "../dice/poker-hand-evaluator.mjs";

/** Traits a hex can be associated with (all Mental traits). `hnh` p.33. */
const HEX_TRAITS = ["cognition", "knowledge", "smarts", "mien", "spirit"];

export class HexDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      // The Mental trait whose die type is used for the hexslingin' roll. hnh p.33.
      trait: new f.StringField({
        required: true,
        choices: HEX_TRAITS,
        initial: "spirit",
      }),
      // Minimum poker hand to activate the hex effect. hnh p.33.
      hand: new f.StringField({
        required: true,
        choices: POKER_HAND_RANKS,
        initial: "pair",
      }),
      // Casting time (free text: "1 action", "1 minute", etc.). hnh p.33.
      speed: new f.StringField({ initial: "1 action" }),
      // How long the effect lasts (free text). hnh p.33.
      duration: new f.StringField({ initial: "instant" }),
      // Range (free text: "touch", "5 yards/level", etc.). hnh p.33.
      range: new f.StringField({ initial: "5 yards/level" }),
      // GM/player description of the hex effect. No rulebook prose.
      description: new f.HTMLField(),
    };
  }

  /** @param {object} source */
  static migrateData(source) {
    return super.migrateData(source);
  }
}
