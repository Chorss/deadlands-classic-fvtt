/**
 * Harrowed overlay — sheet tab descriptor.
 *
 * Exports the PARTS entry and TABS entry injected into every PC archetype
 * sheet when `actor.system.harrowed.isHarrowed === true`. The base character
 * sheet reads from OverlayRegistry and conditionally includes these.
 *
 * @license MIT
 */

export const HARROWED_PART_ID = "harrowed";

export const HARROWED_SHEET_PART = {
  template: "systems/deadlands-classic/templates/actor/parts/harrowed-tab.hbs",
};

export const HARROWED_SHEET_TAB = {
  id: "harrowed",
  group: "sheet",
  icon: "fas fa-skull",
  label: "DEADLANDS.Harrowed.Sheet.Tab.Label",
};
