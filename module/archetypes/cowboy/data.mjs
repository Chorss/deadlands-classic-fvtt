/**
 * CowboyDataModel — the plain gunslinger archetype.
 *
 * The Cowboy adds no arcane subsystem, so it is the base character model with no
 * extra schema. It exists as its own class (and documentType) so the registry
 * pattern stays uniform and future Cowboy-specific tweaks have a home.
 *
 * @license MIT
 */

import { BaseCharacterDataModel } from "../_base/base-character-data.mjs";

export class CowboyDataModel extends BaseCharacterDataModel {}
