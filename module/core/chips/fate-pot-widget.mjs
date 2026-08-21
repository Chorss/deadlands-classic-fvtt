/**
 * FatePotWidget — Marshal-facing window onto the world Fate Pot.
 *
 * Shows the four chip counts + pool total and exposes the two session-boundary
 * operations that previously had no UI entry point (console/macro only):
 * session draw (`FatePot.drawForSession`) and pot refill (`FatePot.reset`).
 * Registered as a `restricted` settings menu — GM only, both at the menu entry
 * and again in `#onDraw`/`#onRefill` as a defense-in-depth guard for anyone
 * who reaches the class directly (a macro, a stale render).
 *
 * @license MIT
 */

import { CHIP_COLORS } from "../config.mjs";
import { FatePot } from "./fate-pot.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FatePotWidget extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "dlc-fate-pot-widget",
    classes: ["deadlands-classic", "dlc-fate-pot-widget"],
    window: { title: "DEADLANDS.Chip.Pot.Title", icon: "fa-solid fa-circle-dollar-to-slot" },
    position: { width: 320, height: "auto" },
    actions: {
      draw: FatePotWidget.#onDraw,
      refill: FatePotWidget.#onRefill,
    },
  };

  /** @override */
  static PARTS = {
    pot: { template: "systems/deadlands-classic/templates/apps/fate-pot-widget.hbs" },
  };

  /** @override */
  async _prepareContext(_options) {
    const pot = FatePot.getData();
    const chips = Object.keys(CHIP_COLORS).map((color) => ({
      color,
      count: pot[color],
      label: game.i18n.localize(
        `DEADLANDS.Chip.${color.charAt(0).toUpperCase()}${color.slice(1)}.Label`
      ),
    }));
    const total = chips.reduce((sum, chip) => sum + chip.count, 0);
    return { chips, total };
  }

  static async #onDraw() {
    if (!game.user.isGM) {
      return;
    }
    await FatePot.drawForSession();
    this.render();
  }

  static async #onRefill() {
    if (!game.user.isGM) {
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("DEADLANDS.Chip.Pot.RefillTitle") },
      content: `<p>${game.i18n.localize("DEADLANDS.Chip.Pot.RefillWarning")}</p>`,
    });
    if (!confirmed) {
      return;
    }
    await FatePot.reset();
    this.render();
  }
}
