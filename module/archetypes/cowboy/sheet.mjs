/**
 * CowboySheet — the Cowboy archetype sheet.
 *
 * No archetype-specific tabs, so it is the base sheet with a distinguishing CSS
 * class. Exists for registry uniformity and future Cowboy-only UI.
 *
 * @license MIT
 */

import { BaseCharacterSheet } from "../_base/base-character-sheet.mjs";

export class CowboySheet extends BaseCharacterSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["cowboy"],
  };
}
