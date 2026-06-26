/**
 * NPC archetype manifest.
 * @license MIT
 */

import { ArchetypeRegistry } from "../../core/archetype-registry.mjs";
import { NpcDataModel } from "./data.mjs";
import { NpcSheet } from "./sheet.mjs";

ArchetypeRegistry.register({
  id: "npc",
  label: "TYPES.Actor.npc",
  dataModel: NpcDataModel,
  sheetClass: NpcSheet,
  defaultIcon: "icons/environment/people/group.webp",
  htmlFields: ["system.biography"],
});
