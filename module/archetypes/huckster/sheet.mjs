/**
 * HucksterSheet — actor sheet for the Huckster archetype.
 *
 * Extends the base character sheet with a "Hexes" tab that shows the hexslingin'
 * aptitude, the last card draw, and all hex items with a Cast button.
 *
 * @license MIT
 */

import { POKER_HAND_RANKS } from "../../core/dice/poker-hand-evaluator.mjs";
import { toPascal } from "../../core/utils.mjs";
import { BaseCharacterSheet } from "../_base/base-character-sheet.mjs";
import { HARROWED_SHEET_PART, HARROWED_SHEET_TAB } from "../_overlays/harrowed/sheet-tab.mjs";
import { castHex } from "./mechanics.mjs";

const TEMPLATE_ROOT = "systems/deadlands-classic/templates/actor/parts";
const DIALOG_ROOT = "systems/deadlands-classic/templates/dialogs";

export class HucksterSheet extends BaseCharacterSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["huckster"],
    actions: {
      castHex: HucksterSheet.#onCastHex,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    header: { template: `${TEMPLATE_ROOT}/header.hbs` },
    tabs: { template: `${TEMPLATE_ROOT}/tabs.hbs` },
    traits: { template: `${TEMPLATE_ROOT}/traits-tab.hbs` },
    combat: { template: `${TEMPLATE_ROOT}/combat-tab.hbs` },
    hexes: { template: `${TEMPLATE_ROOT}/hexes-tab.hbs` },
    harrowed: HARROWED_SHEET_PART,
    gear: { template: `${TEMPLATE_ROOT}/gear-tab.hbs` },
    bio: { template: `${TEMPLATE_ROOT}/bio-tab.hbs` },
  };

  /** @inheritDoc */
  static TABS = {
    sheet: {
      tabs: [
        {
          id: "traits",
          group: "sheet",
          icon: "fas fa-dice-d20",
          label: "DEADLANDS.Sheet.Tab.Traits",
        },
        { id: "combat", group: "sheet", icon: "fas fa-gun", label: "DEADLANDS.Sheet.Tab.Combat" },
        {
          id: "hexes",
          group: "sheet",
          icon: "fas fa-hat-wizard",
          label: "DEADLANDS.Sheet.Tab.Hexes",
        },
        HARROWED_SHEET_TAB,
        { id: "gear", group: "sheet", icon: "fas fa-box", label: "DEADLANDS.Sheet.Tab.Gear" },
        { id: "bio", group: "sheet", icon: "fas fa-feather", label: "DEADLANDS.Sheet.Tab.Bio" },
      ],
      initial: "traits",
    },
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.hexes = this.#prepareHexes();
    context.hexslingin = this.#prepareHexslingin();
    context.lastDraw = this.document.system.lastDraw ?? [];
    context.backlashPending = this.document.system.backlashPending ?? false;
    context.pokerHandChoices = Object.fromEntries(
      POKER_HAND_RANKS.map((k) => [k, `DEADLANDS.Huckster.Hand.${toPascal(k)}`])
    );
    return context;
  }

  /** Hexes tab view model: one entry per hex item. */
  #prepareHexes() {
    return this.document.items
      .filter((i) => i.type === "hex")
      .map((hex) => ({
        id: hex.id,
        name: hex.name,
        img: hex.img,
        trait: hex.system.trait,
        traitLabel: `DEADLANDS.Trait.${toPascal(hex.system.trait)}.Label`,
        hand: hex.system.hand,
        handLabel: `DEADLANDS.Huckster.Hand.${toPascal(hex.system.hand)}`,
        speed: hex.system.speed,
        duration: hex.system.duration,
        range: hex.system.range,
      }));
  }

  /** Hexslingin' aptitude view model. */
  #prepareHexslingin() {
    const data = this.document.system.hexslingin ?? { level: 0, modifier: 0 };
    return {
      level: data.level,
      modifier: data.modifier,
      levelPath: "system.hexslingin.level",
      modifierPath: "system.hexslingin.modifier",
    };
  }

  // ── Action handlers ──────────────────────────────────────────────────────────

  /**
   * Cast a hex from the sheet. Shows a dialog then calls castHex().
   * @this {HucksterSheet}
   */
  static async #onCastHex(_event, target) {
    const hexId = target.dataset.hexId;
    const hexItem = this.document.items.get(hexId);
    if (!hexItem) {
      return;
    }

    const maxWhite = this.document.system.chips?.white ?? 0;
    const content = await foundry.applications.handlebars.renderTemplate(
      `${DIALOG_ROOT}/cast-hex-dialog.hbs`,
      {
        hexName: hexItem.name,
        maxWhite,
      }
    );

    const params = await foundry.applications.api.DialogV2.prompt({
      window: {
        title: game.i18n.format("DEADLANDS.Huckster.Dialog.CastTitle", { hex: hexItem.name }),
      },
      content,
      ok: {
        label: game.i18n.localize("DEADLANDS.Huckster.Dialog.Cast"),
        callback: (_event, button) => {
          const els = button.form.elements;
          return {
            modifier: Number(els.modifier?.value ?? 0),
            whiteSpend: Number(els.whiteChips?.value ?? 0),
          };
        },
      },
    });

    if (!params) {
      return;
    }

    // Clamp to the actor's real white-chip count — the dialog's max is
    // advisory only, so a stale form value must not grant free extra dice.
    const whiteSpend = Math.min(Math.max(0, params.whiteSpend), maxWhite);
    if (whiteSpend > 0) {
      await this.document.update({
        "system.chips.white": maxWhite - whiteSpend,
      });
    }

    await castHex(this.document, hexItem, {
      modifier: params.modifier,
      whiteSpend,
    });
  }
}
