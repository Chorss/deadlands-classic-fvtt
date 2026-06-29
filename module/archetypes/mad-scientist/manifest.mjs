/**
 * Mad Scientist archetype manifest — self-registers with the ArchetypeRegistry
 * and ItemRegistry on import. The `gizmo` item type is Mad Scientist-specific.
 *
 * @license MIT
 */

import { ArchetypeRegistry } from "../../core/archetype-registry.mjs";
import { ItemRegistry } from "../../core/item-registry.mjs";
import { GizmoDataModel } from "../../core/items/gizmo-data.mjs";
import { MadScientistDataModel } from "./data.mjs";
import { MadScientistSheet } from "./sheet.mjs";

ArchetypeRegistry.register({
  id: "madScientist",
  label: "TYPES.Actor.madScientist",
  dataModel: MadScientistDataModel,
  sheetClass: MadScientistSheet,
  defaultIcon: "icons/equipment/head/goggles-leather-worn-brown.webp",
  htmlFields: ["system.biography"],
});

ItemRegistry.register({
  id: "gizmo",
  label: "TYPES.Item.gizmo",
  dataModel: GizmoDataModel,
  defaultIcon: "icons/equipment/held/key-brown-worn.webp",
  htmlFields: ["system.description"],
});
