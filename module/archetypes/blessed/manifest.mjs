/**
 * Blessed archetype manifest — self-registers with the ArchetypeRegistry and
 * ItemRegistry on import. The `miracle` item type is Blessed-specific.
 *
 * @license MIT
 */

import { ArchetypeRegistry } from "../../core/archetype-registry.mjs";
import { ItemRegistry } from "../../core/item-registry.mjs";
import { MiracleDataModel } from "../../core/items/miracle-data.mjs";
import { BlessedDataModel } from "./data.mjs";
import { BlessedSheet } from "./sheet.mjs";

ArchetypeRegistry.register({
  id: "blessed",
  label: "TYPES.Actor.blessed",
  dataModel: BlessedDataModel,
  sheetClass: BlessedSheet,
  defaultIcon: "icons/magic/holy/chalice-glowing-gold.webp",
  htmlFields: ["system.biography"],
});

ItemRegistry.register({
  id: "miracle",
  label: "TYPES.Item.miracle",
  dataModel: MiracleDataModel,
  defaultIcon: "icons/magic/holy/prayer-hands-glowing-yellow.webp",
  htmlFields: ["system.description"],
});
