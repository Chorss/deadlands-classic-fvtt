/**
 * Huckster archetype manifest — self-registers with the ArchetypeRegistry and
 * ItemRegistry on import. The `hex` item type is Huckster-specific and lives here
 * rather than in core/items/ (plan §3.6).
 *
 * @license MIT
 */

import { ArchetypeRegistry } from "../../core/archetype-registry.mjs";
import { ItemRegistry } from "../../core/item-registry.mjs";
import { HexDataModel } from "../../core/items/hex-data.mjs";
import { HucksterDataModel } from "./data.mjs";
import { HucksterSheet } from "./sheet.mjs";

ArchetypeRegistry.register({
  id: "huckster",
  label: "TYPES.Actor.huckster",
  dataModel: HucksterDataModel,
  sheetClass: HucksterSheet,
  defaultIcon: "icons/magic/control/debuff-chains-blue.webp",
  htmlFields: ["system.biography"],
});

ItemRegistry.register({
  id: "hex",
  label: "TYPES.Item.hex",
  dataModel: HexDataModel,
  defaultIcon: "icons/magic/control/debuff-chains-blue.webp",
  htmlFields: ["system.description"],
});
