import { BaseCharacterSheet } from "../_base/base-character-sheet.mjs";

const SEVERITY_LABELS = [
  "DEADLANDS.Wound.Severity.None",
  "DEADLANDS.Wound.Severity.Light",
  "DEADLANDS.Wound.Severity.Heavy",
  "DEADLANDS.Wound.Severity.Serious",
  "DEADLANDS.Wound.Severity.Critical",
  "DEADLANDS.Wound.Severity.Maimed",
];

export class MookSheet extends BaseCharacterSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["mook"],
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Replace 8-location wound context with the mook's single body slot.
    const severity = this.document.system.wounds?.body?.severity ?? 0;
    const pips = Array.from({ length: 5 }, (_, i) => ({ filled: i < severity }));
    context.wounds = {
      woundLocations: [
        {
          id: "body",
          label: "DEADLANDS.HitLocation.Body.Label",
          severity,
          severityLabel: SEVERITY_LABELS[severity] ?? SEVERITY_LABELS[0],
          isLimb: false,
          isMaimed: severity >= 5,
          pips,
          path: "system.wounds.body.severity",
        },
      ],
      wind: context.wounds.wind,
      windedClass: context.wounds.windedClass,
    };

    // Mooks have no chips.
    context.chips = [];

    return context;
  }
}
