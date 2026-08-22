/**
 * WeaponSheet — ApplicationV2 item sheet for the weapon item type.
 *
 * @license MIT
 */

import { toPascal } from "../utils.mjs";
import { BaseItemSheet } from "./_base/base-item-sheet.mjs";
import { RANGE_TYPES, WEAPON_CATEGORIES } from "./weapon-data.mjs";

const TEMPLATE_ROOT = "systems/deadlands-classic/templates/item";

export class WeaponSheet extends BaseItemSheet {
  /** @inheritDoc */
  static PARTS = {
    form: { template: `${TEMPLATE_ROOT}/weapon-sheet.hbs` },
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = context.system;
    context.categoryChoices = Object.fromEntries(
      WEAPON_CATEGORIES.map((c) => [c, `DEADLANDS.Item.Weapon.Category.${toPascal(c)}`])
    );
    context.rangeTypeChoices = Object.fromEntries(
      RANGE_TYPES.map((r) => [r, `DEADLANDS.Item.Weapon.RangeType.${toPascal(r)}`])
    );
    context.categoryLabel = system.category
      ? game.i18n.localize(`DEADLANDS.Item.Weapon.Category.${toPascal(system.category)}`)
      : "";
    return context;
  }
}
