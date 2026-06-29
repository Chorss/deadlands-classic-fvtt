/**
 * Mook archetype manifest.
 * @license MIT
 */

import { ArchetypeRegistry } from "../../core/archetype-registry.mjs";
import { MookDataModel } from "./data.mjs";
import { MookSheet } from "./sheet.mjs";

ArchetypeRegistry.register({
  id: "mook",
  label: "TYPES.Actor.mook",
  dataModel: MookDataModel,
  sheetClass: MookSheet,
  defaultIcon: "icons/environment/people/silhouette.webp",
  htmlFields: [],
});
