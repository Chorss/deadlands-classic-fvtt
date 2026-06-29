/**
 * Shaman archetype manifest — self-registers with the ArchetypeRegistry and
 * ItemRegistry on import. The `favor` item type is Shaman-specific.
 *
 * @license MIT
 */

import { ArchetypeRegistry } from "../../core/archetype-registry.mjs";
import { ItemRegistry } from "../../core/item-registry.mjs";
import { FavorDataModel } from "../../core/items/favor-data.mjs";
import { ShamanDataModel } from "./data.mjs";
import { ShamanSheet } from "./sheet.mjs";

ArchetypeRegistry.register({
  id: "shaman",
  label: "TYPES.Actor.shaman",
  dataModel: ShamanDataModel,
  sheetClass: ShamanSheet,
  defaultIcon: "icons/magic/nature/wolf-paw-glow-teal-blue.webp",
  htmlFields: ["system.biography"],
});

ItemRegistry.register({
  id: "favor",
  label: "TYPES.Item.favor",
  dataModel: FavorDataModel,
  defaultIcon: "icons/magic/nature/elemental-spirit-green.webp",
  htmlFields: ["system.description"],
});
