/**
 * Harrowed overlay — schema fields merged into every PC archetype.
 *
 * A Harrowed character is a PC who died and returned possessed by a manitou.
 * All PC archetypes (Cowboy, Huckster, …) may become Harrowed; the overlay
 * contributes extra schema fields rather than a new documentType. dlc p.194,
 * bod p.10-12.
 *
 * Field semantics verified against dlc p.194-199, p.253-254, bod p.10-12,
 * p.62-63, p.80-82.
 *
 * @license MIT
 */

/**
 * Returns the extra TypeDataModel schema fields for the Harrowed overlay.
 * Merged into BaseCharacterDataModel.defineSchema() for every PC archetype.
 *
 * @returns {Record<string, foundry.data.fields.DataField>}
 */
export function harrowedSchemaFields() {
  const f = foundry.data.fields;

  return {
    harrowed: new f.SchemaField(
      {
        // True when the PC has returned from beyond the pale (drew a Joker on
        // death). Unlocks the Harrowed tab, Dominion checks, and powers.
        // dlc p.194.
        isHarrowed: new f.BooleanField({ initial: false }),

        // Dominion — the ongoing Spirit tug-of-war between the PC and the
        // manitou inside. Both sides roll Spirit at the start of each session
        // (during sleep); each adds their Dominion points to the roll.
        // Winner gains 1 pt per success and 1 per raise. bod p.62, p.80.
        dominion: new f.SchemaField({
          // PC's current Dominion points. Starts at Spirit die value / 2 on
          // creation. Reaching 0 → Total Dominion (manitou permanent).
          // bod p.12.
          spiritControl: new f.NumberField({ integer: true, min: 0, initial: 0 }),
          // Serialised result of the last Dominion roll (for UI display only;
          // not a rulebook field). Null until first roll this campaign.
          lastRoll: new f.ObjectField({ nullable: true, initial: null }),
        }),

        // Harrowed Powers — Common Powers (free, dlc p.196-198) plus Purchased
        // Powers (10 pts at creation; 10 Bounty per new power after. dlc p.199,
        // bod p.19-60). Each entry tracks the power name and current level.
        harrowedPowers: new f.ArrayField(
          new f.SchemaField({
            id: new f.StringField({ required: true, blank: false }),
            name: new f.StringField({ required: true, blank: false }),
            level: new f.NumberField({ integer: true, min: 1, initial: 1 }),
            // "common" powers are free; "purchased" cost Bounty. bod p.19-20.
            kind: new f.StringField({
              choices: ["common", "purchased"],
              initial: "purchased",
            }),
            description: new f.StringField({ initial: "" }),
          })
        ),

        // Counting Coup — powers stolen from slain fearmongers/abominations by
        // standing over them and absorbing their essence. dlc p.198, p.254,
        // bod p.70, p.100-102. Each coup entry records its source creature and
        // the stolen power, along with any taint/curse attached.
        countingCoup: new f.ArrayField(
          new f.SchemaField({
            // Name of the fearmonger/abomination killed to gain this coup.
            source: new f.StringField({ required: true, blank: false }),
            // The mechanical effect or power name granted by the coup.
            power: new f.StringField({ required: true, blank: false }),
            // Any curse, taint, or Hindrance that came with the coup.
            // bod p.70: "there's always some sort of price to pay".
            taint: new f.StringField({ initial: "" }),
          })
        ),
      },
      {
        // The whole block is optional so existing actors without the overlay
        // still validate cleanly before the overlay is activated.
        required: false,
      }
    ),
  };
}
