/**
 * EdgeSheet — ApplicationV2 item sheet shared by the edge and hindrance item
 * types (one template, `isHindrance` switches the header pill/accent colour).
 *
 * @license MIT
 */

import { BaseItemSheet } from "./_base/base-item-sheet.mjs";

const TEMPLATE_ROOT = "systems/deadlands-classic/templates/item";

export class EdgeSheet extends BaseItemSheet {
  /** @inheritDoc */
  static PARTS = {
    form: { template: `${TEMPLATE_ROOT}/edge-sheet.hbs` },
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // EdgeDataModel uses `cost`, HindranceDataModel uses `points` — normalize
    // to one context field rather than renaming EdgeDataModel.cost, which
    // would be a data migration for the Edges compendium (0.2.0), not a
    // sheet-layer concern.
    context.isHindrance = this.document.type === "hindrance";
    context.points = context.isHindrance ? context.system.points : context.system.cost;
    return context;
  }
}
