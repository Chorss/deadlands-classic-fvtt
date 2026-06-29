/**
 * Cowboy archetype manifest — self-registers with the ArchetypeRegistry.
 *
 * Importing this module (from the entry point) is all it takes to add the
 * Cowboy actor type: the data model and sheet are wired into Foundry by the
 * entry's `init` hook reading the registry.
 *
 * @license MIT
 */

import { ArchetypeRegistry } from "../../core/archetype-registry.mjs";
import { CowboyDataModel } from "./data.mjs";
import { CowboySheet } from "./sheet.mjs";

ArchetypeRegistry.register({
  id: "cowboy",
  label: "TYPES.Actor.cowboy",
  dataModel: CowboyDataModel,
  sheetClass: CowboySheet,
  defaultIcon: "icons/environment/people/cowboy.webp",
  htmlFields: ["system.biography"],
});
