/**
 * MookDataModel — simplified NPC archetype with a single wound track.
 *
 * Mooks (unnamed grunts) use one wound pool instead of 8 hit locations —
 * they have no chips, no grit, no bounty. When `wounds.body.severity` reaches
 * 5 the mook is taken out of the fight (Maimed / killed). dlc mook rules.
 *
 * Mooks still have the 10 Traits and Aptitudes so the GM can make trait rolls
 * when needed.
 *
 * @license MIT
 */

import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

export class MookDataModel extends BaseCharacterDataModel {
  static defineSchema() {
    const schema = super.defineSchema();
    const f = foundry.data.fields;

    // Replace the 8-location wound track with a single body slot.
    schema.wounds = new f.SchemaField({
      body: new f.SchemaField({
        severity: new f.NumberField({ integer: true, min: 0, max: 5, initial: 0 }),
      }),
    });

    // Mooks don't use chips, grit, or bounty.
    delete schema.chips;
    delete schema.grit;
    delete schema.bounty;

    return schema;
  }
}
